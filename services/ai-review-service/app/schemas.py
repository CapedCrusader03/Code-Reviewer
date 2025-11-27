from pydantic import BaseModel
from typing import List, Optional


class ReviewRequest(BaseModel):
    diff: str
    static_metrics: Optional[dict] = None


class Finding(BaseModel):
    type: str
    severity: str
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    message: str
    suggestion: Optional[str] = None


class ReviewResponse(BaseModel):
    quality_score: int
    findings: List[Finding]
    plantuml: str
    uml_s3_url: Optional[str] = None






