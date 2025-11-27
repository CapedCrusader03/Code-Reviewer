import json
import logging
import os
from typing import Dict, Any, Optional
from app.schemas import ReviewResponse, Finding

logger = logging.getLogger(__name__)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "").lower()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


def _get_stub_result() -> Dict[str, Any]:
    """Return stub result when LLM is not configured."""
    return {
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


def _call_openai(prompt: str) -> Dict[str, Any]:
    """Call OpenAI API and parse the response."""
    try:
        from openai import OpenAI
        
        client = OpenAI(api_key=OPENAI_API_KEY)
        
        # Create a structured prompt that requests JSON output
        system_prompt = """You are a code review assistant. Analyze the provided code diff and return a JSON response with:
- quality_score: integer (0-100)
- findings: array of objects with type, severity, message, suggestion (optional), file_path (optional), line_number (optional)
- plantuml: string with PlantUML diagram code

Return ONLY valid JSON, no markdown formatting."""
        
        logger.info("Calling OpenAI API...")
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        logger.info("OpenAI response received (length: %d)", len(content) if content else 0)
        
        # Parse JSON response
        result = json.loads(content) if content else {}
        
        # Validate and normalize the response
        if "quality_score" not in result:
            result["quality_score"] = 80
        
        if "findings" not in result:
            result["findings"] = []
        
        if "plantuml" not in result:
            result["plantuml"] = "@startuml\nclass CodeReview {\n  +quality_score: int\n  +findings: List\n}\n@enduml"
        
        logger.info("OpenAI result parsed: quality_score=%d, findings_count=%d", 
                   result.get("quality_score", 0), len(result.get("findings", [])))
        
        return result
        
    except ImportError:
        logger.error("OpenAI package not installed. Install with: pip install openai")
        return _get_stub_result()
    except Exception as e:
        logger.error("Error calling OpenAI API: %s", str(e))
        logger.info("Falling back to stub result")
        return _get_stub_result()


def llm_run(prompt: str) -> Dict[str, Any]:
    """
    LLM function that calls OpenAI if configured, otherwise returns stub.
    
    Args:
        prompt: The prompt string to send to the LLM
        
    Returns:
        Dictionary with structured review results
    """
    logger.info("llm_run called with prompt (length: %d)", len(prompt))
    logger.debug("Prompt preview: %s", prompt[:200] if len(prompt) > 200 else prompt)
    
    # Check if OpenAI is configured
    if LLM_PROVIDER == "openai" and OPENAI_API_KEY:
        logger.info("Using OpenAI provider")
        return _call_openai(prompt)
    else:
        logger.info("Using stub implementation (LLM_PROVIDER=%s, OPENAI_API_KEY=%s)", 
                   LLM_PROVIDER or "not set", "set" if OPENAI_API_KEY else "not set")
        result = _get_stub_result()
        logger.info("llm_run returning stub result with quality_score: %d", result["quality_score"])
        return result

