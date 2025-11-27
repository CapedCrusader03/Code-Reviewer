import logging
import uuid
from fastapi import FastAPI
from app.schemas import ReviewRequest, ReviewResponse, Finding
from app.llm import llm_run
from app.s3_utils import upload_plantuml

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Code Review Service", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok"}


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
    llm_result = llm_run(prompt)
    
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
    findings = [
        Finding(
            type=finding.get("type", "suggestion"),
            severity=finding.get("severity", "low"),
            file_path=finding.get("file_path"),
            line_number=finding.get("line_number"),
            message=finding.get("message", ""),
            suggestion=finding.get("suggestion")
        )
        for finding in llm_result.get("findings", [])
    ]
    
    return ReviewResponse(
        quality_score=llm_result.get("quality_score", 80),
        findings=findings,
        plantuml=plantuml_text,
        uml_s3_url=uml_s3_url
    )

