import json
import logging
from typing import Dict, Any
from app.schemas import ReviewResponse, Finding

logger = logging.getLogger(__name__)


def llm_run(prompt: str) -> Dict[str, Any]:
    """
    Stub LLM function that returns structured JSON.
    In production, this will call OpenAI/Claude/etc.
    
    Args:
        prompt: The prompt string to send to the LLM
        
    Returns:
        Dictionary with structured review results
    """
    logger.info("llm_run called with prompt (length: %d)", len(prompt))
    logger.debug("Prompt preview: %s", prompt[:200] if len(prompt) > 200 else prompt)
    
    # Stub implementation - returns structured JSON
    # This will be replaced with actual LLM call in T034
    result = {
        "quality_score": 80,
        "findings": [
            {
                "type": "suggestion",
                "severity": "low",
                "message": "Consider adding more detailed comments to improve code readability",
                "suggestion": "Add docstrings and inline comments where complex logic exists"
            }
        ],
        "plantuml": "@startuml\nclass CodeReview {\n  +quality_score: int\n  +findings: List\n}\n@enduml"
    }
    
    logger.info("llm_run returning result with quality_score: %d", result["quality_score"])
    return result

