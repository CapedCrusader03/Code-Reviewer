from fastapi import FastAPI
from app.schemas import ReviewRequest, ReviewResponse, Finding

app = FastAPI(title="AI Code Review Service", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/review", response_model=ReviewResponse)
async def review(request: ReviewRequest):
    """Review code diff and return static analysis results."""
    # Static response for MVP
    return ReviewResponse(
        quality_score=80,
        findings=[
            Finding(
                type="suggestion",
                severity="low",
                message="Consider adding more detailed comments to improve code readability"
            )
        ],
        plantuml="@startuml\nclass CodeReview {\n  +quality_score: int\n  +findings: List\n}\n@enduml",
        uml_s3_url=None
    )

