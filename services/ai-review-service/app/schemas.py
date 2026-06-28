from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal


class ReviewRequest(BaseModel):
    diff: str
    static_metrics: Optional[dict] = None
    # Full file contents of changed files and their resolved local imports.
    # Key = relative file path, Value = complete file contents.
    code_context: Optional[Dict[str, str]] = None


class Finding(BaseModel):
    type: Literal["code_smell", "security_issue", "suggestion", "best_practice"]
    severity: Literal["low", "medium", "high", "critical"]
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    message: str = Field(description="Actionable description of the finding.")
    suggestion: Optional[str] = Field(
        None,
        description="Suggested code snippet to fix the issue (shown as a GitHub suggestion block)."
    )


class ReviewResponse(BaseModel):
    quality_score: int = Field(
        description="Unified code quality score from 0 (unacceptable) to 100 (excellent)."
    )
    findings: List[Finding]
    plantuml: str = Field(
        description="PlantUML diagram text representing the architecture or flow modified by this PR."
    )
    uml_s3_url: Optional[str] = None
