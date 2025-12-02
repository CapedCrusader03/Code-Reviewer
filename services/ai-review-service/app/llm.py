import json
import logging
import os
from typing import Dict, Any, Optional
from app.schemas import ReviewResponse, Finding
from app.parameter_store import get_llm_api_key, get_parameter_from_store

logger = logging.getLogger(__name__)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "").lower()
USE_PARAMETER_STORE = os.getenv("USE_PARAMETER_STORE", "true").lower() == "true"

# Get API keys from Parameter Store or environment variables
if USE_PARAMETER_STORE:
    OPENAI_API_KEY = get_parameter_from_store("/code-reviewer/openai-api-key") or os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY = get_parameter_from_store("/code-reviewer/gemini-api-key") or os.getenv("GEMINI_API_KEY", "")
else:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


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

IMPORTANT: The 'type' field must be one of: 'code_smell', 'security_issue', 'suggestion', or 'best_practice'
The 'severity' field must be one of: 'low', 'medium', 'high', or 'critical'

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


def _call_gemini(prompt: str) -> Dict[str, Any]:
    """Call Google Gemini API and parse the response."""
    try:
        import google.generativeai as genai
        
        genai.configure(api_key=GEMINI_API_KEY)
        
        # Create a structured prompt that requests JSON output
        system_instruction = """You are a code review assistant. Analyze the provided code diff and return a JSON response with:
- quality_score: integer (0-100)
- findings: array of objects with type, severity, message, suggestion (optional), file_path (optional), line_number (optional)
- plantuml: string with PlantUML diagram code

IMPORTANT: The 'type' field must be one of: 'code_smell', 'security_issue', 'suggestion', or 'best_practice'
The 'severity' field must be one of: 'low', 'medium', 'high', or 'critical'

Return ONLY valid JSON, no markdown formatting."""
        
        full_prompt = f"{system_instruction}\n\n{prompt}"
        
        logger.info("Calling Gemini API...")
        # Use gemini-2.5-flash (latest, faster) or gemini-1.5-pro (more capable)
        # gemini-pro is deprecated, use gemini-2.5-flash or gemini-1.5-pro
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Configure generation settings for JSON output
        try:
            # Try with response_mime_type (newer API)
            generation_config = genai.types.GenerationConfig(
                temperature=0.3,
                response_mime_type="application/json"
            )
            response = model.generate_content(
                full_prompt,
                generation_config=generation_config
            )
        except (AttributeError, TypeError):
            # Fallback for older API versions
            generation_config = genai.types.GenerationConfig(
                temperature=0.3
            )
            response = model.generate_content(
                full_prompt,
                generation_config=generation_config
            )
        
        content = response.text
        logger.info("Gemini response received (length: %d)", len(content) if content else 0)
        logger.debug("Gemini raw response: %s", content[:500] if content else "None")
        
        # Parse JSON response
        try:
            result = json.loads(content) if content else {}
        except json.JSONDecodeError as e:
            logger.error("Failed to parse Gemini JSON response: %s", str(e))
            logger.error("Response content: %s", content[:1000] if content else "None")
            # Try to extract JSON from markdown code blocks if present
            if content and "```json" in content:
                try:
                    json_start = content.find("```json") + 7
                    json_end = content.find("```", json_start)
                    if json_end > json_start:
                        content = content[json_start:json_end].strip()
                        result = json.loads(content)
                        logger.info("Extracted JSON from markdown code block")
                    else:
                        result = {}
                except:
                    result = {}
            else:
                result = {}
        
        # Validate and normalize the response
        if "quality_score" not in result or result.get("quality_score") is None:
            logger.warning("quality_score missing or None, defaulting to 80")
            result["quality_score"] = 80
        else:
            # Ensure quality_score is a valid integer between 0-100
            try:
                score = int(result["quality_score"])
                if score < 0 or score > 100:
                    logger.warning("quality_score out of range (%d), clamping to 0-100", score)
                    result["quality_score"] = max(0, min(100, score))
                else:
                    result["quality_score"] = score
            except (ValueError, TypeError):
                logger.warning("quality_score is not a valid integer, defaulting to 80")
                result["quality_score"] = 80
        
        if "findings" not in result or not isinstance(result.get("findings"), list):
            result["findings"] = []
        
        if "plantuml" not in result:
            result["plantuml"] = "@startuml\nclass CodeReview {\n  +quality_score: int\n  +findings: List\n}\n@enduml"
        
        logger.info("Gemini result parsed: quality_score=%d, findings_count=%d", 
                   result.get("quality_score", 0), len(result.get("findings", [])))
        
        return result
        
    except ImportError:
        logger.error("Google Generative AI package not installed. Install with: pip install google-generativeai")
        return _get_stub_result()
    except Exception as e:
        logger.error("Error calling Gemini API: %s", str(e))
        logger.info("Falling back to stub result")
        return _get_stub_result()


def llm_run(prompt: str) -> Dict[str, Any]:
    """
    LLM function that calls OpenAI, Gemini, or returns stub based on configuration.
    
    Args:
        prompt: The prompt string to send to the LLM
        
    Returns:
        Dictionary with structured review results
    """
    logger.info("llm_run called with prompt (length: %d)", len(prompt))
    logger.debug("Prompt preview: %s", prompt[:200] if len(prompt) > 200 else prompt)
    
    # Check which provider is configured
    if LLM_PROVIDER == "gemini" and GEMINI_API_KEY:
        logger.info("Using Gemini provider")
        return _call_gemini(prompt)
    elif LLM_PROVIDER == "openai" and OPENAI_API_KEY:
        logger.info("Using OpenAI provider")
        return _call_openai(prompt)
    else:
        logger.info("Using stub implementation (LLM_PROVIDER=%s, GEMINI_API_KEY=%s, OPENAI_API_KEY=%s)", 
                   LLM_PROVIDER or "not set", 
                   "set" if GEMINI_API_KEY else "not set",
                   "set" if OPENAI_API_KEY else "not set")
        result = _get_stub_result()
        logger.info("llm_run returning stub result with quality_score: %d", result["quality_score"])
        return result

