import logging
import uuid
import time
from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from app.schemas import ReviewRequest, ReviewResponse, Finding
from app.llm import llm_run, AllSpecialistsFailedException
from app.s3_utils import upload_plantuml
from app.metrics import reviews_total, ai_latency_ms, get_metrics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Code Review Service", version="2.0.0")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return PlainTextResponse(content=get_metrics(), media_type="text/plain")


@app.post("/review", response_model=ReviewResponse)
async def review(request: ReviewRequest):
    """
    Review code diff using a multi-agent AI pipeline.

    Receives:
    - diff: the raw git diff string
    - static_metrics: linter and complexity results from the static worker
    - code_context: full contents of modified files and their local imports

    Returns a structured ReviewResponse with quality_score, findings, and plantuml.
    """
    logger.info(
        "Review request received | diff_length=%d | context_files=%d",
        len(request.diff),
        len(request.code_context or {}),
    )

    start_time = time.time()

    try:
        # Run the multi-agent pipeline, passing both the diff and the code context
        llm_result = llm_run(request.diff, code_context=request.code_context)

        latency_ms = (time.time() - start_time) * 1000
        ai_latency_ms.observe(latency_ms)
        reviews_total.labels(status="success").inc()

    except AllSpecialistsFailedException as e:
        latency_ms = (time.time() - start_time) * 1000
        ai_latency_ms.observe(latency_ms)
        reviews_total.labels(status="error").inc()
        logger.error("All specialist agents failed: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail="AI Review Service: All specialist agents failed. The LLM provider may be unavailable."
        )
    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        ai_latency_ms.observe(latency_ms)
        reviews_total.labels(status="error").inc()
        logger.error("Unexpected error during review: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Internal review error: {str(e)}")

    # Upload PlantUML diagram to S3
    plantuml_text = llm_result.get("plantuml", "@startuml\n@enduml")
    job_id = str(uuid.uuid4())
    uml_s3_url = upload_plantuml(plantuml_text, job_id=job_id)

    if uml_s3_url:
        logger.info("PlantUML uploaded to S3: %s", uml_s3_url)
    else:
        logger.warning("PlantUML S3 upload failed, continuing without S3 URL")

    # Map llm_result findings back to typed Finding objects
    valid_types = ['code_smell', 'security_issue', 'suggestion', 'best_practice']
    valid_severities = ['low', 'medium', 'high', 'critical']

    def normalize_type(t: str) -> str:
        return t.lower() if t.lower() in valid_types else 'suggestion'

    def normalize_severity(s: str) -> str:
        return s.lower() if s.lower() in valid_severities else 'low'

    findings = [
        Finding(
            type=normalize_type(f.get("type", "suggestion")),
            severity=normalize_severity(f.get("severity", "low")),
            file_path=f.get("file_path"),
            line_number=f.get("line_number"),
            message=f.get("message", ""),
            suggestion=f.get("suggestion"),
        )
        for f in llm_result.get("findings", [])
    ]

    quality_score = llm_result.get("quality_score", 80)
    if not isinstance(quality_score, int) or not (0 <= quality_score <= 100):
        quality_score = 80

    logger.info(
        "Review complete | quality_score=%d | findings=%d | latency_ms=%.1f",
        quality_score,
        len(findings),
        latency_ms,
    )

    return ReviewResponse(
        quality_score=quality_score,
        findings=findings,
        plantuml=plantuml_text,
        uml_s3_url=uml_s3_url,
    )
