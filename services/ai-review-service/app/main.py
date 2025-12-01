import logging
import uuid
import time
from fastapi import FastAPI, Response
from fastapi.responses import PlainTextResponse
from app.schemas import ReviewRequest, ReviewResponse, Finding
from app.llm import llm_run
from app.s3_utils import upload_plantuml
from app.metrics import reviews_total, ai_latency_ms, get_metrics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Code Review Service", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return PlainTextResponse(content=get_metrics(), media_type="text/plain")


@app.post("/review", response_model=ReviewResponse)
async def review(request: ReviewRequest):
    """Review code diff and return static analysis results."""
    logger.info("Review request received, diff length: %d", len(request.diff))
    
    # Create prompt from diff
    prompt = f"""Review the following code diff and provide a structured analysis:

{request.diff}

Please analyze the code changes and provide:
1. A quality score (0-100)
2. List of findings (code smells, security issues, suggestions)
3. A PlantUML diagram representation

Return the response in JSON format."""
    
    # Call LLM (stub for now)
    logger.info("Calling llm_run with prompt")
    
    # Start timing for metrics
    start_time = time.time()
    
    try:
        llm_result = llm_run(prompt)
        
        # Record latency in milliseconds
        latency_ms = (time.time() - start_time) * 1000
        ai_latency_ms.observe(latency_ms)
        
        # Increment success counter
        reviews_total.labels(status='success').inc()
    except Exception as e:
        # Record latency even on error
        latency_ms = (time.time() - start_time) * 1000
        ai_latency_ms.observe(latency_ms)
        
        # Increment error counter
        reviews_total.labels(status='error').inc()
        raise
    
    # Get PlantUML text
    plantuml_text = llm_result.get("plantuml", "@startuml\n@enduml")
    
    # Upload PlantUML to S3
    job_id = str(uuid.uuid4())
    logger.info("Uploading PlantUML to S3 with job_id: %s", job_id)
    uml_s3_url = upload_plantuml(plantuml_text, job_id=job_id)
    
    if uml_s3_url:
        logger.info("PlantUML uploaded successfully: %s", uml_s3_url)
    else:
        logger.warning("Failed to upload PlantUML to S3, continuing without S3 URL")
    
    # Convert LLM result to ReviewResponse
    try:
        # Valid enum values
        valid_types = ['code_smell', 'security_issue', 'suggestion', 'best_practice']
        valid_severities = ['low', 'medium', 'high', 'critical']
        
        def normalize_type(type_str: str) -> str:
            """Normalize finding type to valid enum value."""
            if not type_str:
                return 'suggestion'
            lower_type = type_str.lower()
            # Map common variations
            if 'error' in lower_type or 'issue' in lower_type or 'bug' in lower_type:
                return 'code_smell'
            if 'security' in lower_type or 'vulnerability' in lower_type:
                return 'security_issue'
            if 'best' in lower_type or 'practice' in lower_type or 'pattern' in lower_type:
                return 'best_practice'
            return lower_type if lower_type in valid_types else 'suggestion'
        
        def normalize_severity(severity_str: str) -> str:
            """Normalize severity to valid enum value."""
            if not severity_str:
                return 'low'
            lower_severity = severity_str.lower()
            return lower_severity if lower_severity in valid_severities else 'low'
        
        findings = [
            Finding(
                type=normalize_type(finding.get("type", "suggestion")),
                severity=normalize_severity(finding.get("severity", "low")),
                file_path=finding.get("file_path"),
                line_number=finding.get("line_number"),
                message=finding.get("message", ""),
                suggestion=finding.get("suggestion")
            )
            for finding in llm_result.get("findings", [])
        ]
        
        quality_score = llm_result.get("quality_score", 80)
        # Ensure quality_score is valid (0-100)
        if not isinstance(quality_score, int) or quality_score < 0 or quality_score > 100:
            logger.warning("Invalid quality_score %s, defaulting to 80", quality_score)
            quality_score = 80
        
        logger.info("Returning review response: quality_score=%d, findings_count=%d, uml_s3_url=%s", 
                   quality_score, len(findings), uml_s3_url is not None)
        
        return ReviewResponse(
            quality_score=quality_score,
            findings=findings,
            plantuml=plantuml_text,
            uml_s3_url=uml_s3_url
        )
    except Exception as e:
        logger.error("Error creating ReviewResponse: %s", str(e))
        logger.error("llm_result: %s", str(llm_result)[:500])
        # Return a safe fallback response
        return ReviewResponse(
            quality_score=80,
            findings=[],
            plantuml="@startuml\n@enduml",
            uml_s3_url=None
        )

