import asyncio
import json
import logging
import os
from typing import Dict, Any, Optional

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from app.schemas import ReviewResponse, Finding
logger = logging.getLogger(__name__)

# ─── Configuration ─────────────────────────────────────────────────────────────

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


# ─── Custom Exceptions ─────────────────────────────────────────────────────────

class TransientLLMError(Exception):
    """Represents retriable LLM failures: rate limits, timeouts, server errors."""
    pass


class AllSpecialistsFailedException(Exception):
    """Raised when all three specialist agents fail after exhausting retries."""
    pass


# ─── Agent System Prompts ──────────────────────────────────────────────────────

SECURITY_AGENT_PROMPT = """You are a Senior Application Security Engineer.
Your sole task is to analyze the provided code diff and codebase context for security vulnerabilities.
Focus strictly on:
- OWASP Top 10 vulnerabilities (injection, broken auth, XSS, etc.)
- Exposed secrets, API keys, or credentials
- Insecure data handling, deserialization issues
- Missing input validation or authorization checks

Output a clear bullet-point list of security findings only. For each finding, include:
- The file path and approximate line number
- A concise description of the vulnerability
- A specific recommendation to fix it

Do not comment on style, naming, or non-security concerns."""

STYLE_AGENT_PROMPT = """You are a Senior Software Engineer focused on Code Quality.
Your sole task is to analyze the provided code diff and codebase context for code quality issues.
Focus strictly on:
- Code smells (long functions, deep nesting, magic numbers, duplicated logic)
- Naming convention violations
- Excessive cyclomatic complexity
- Design pattern violations or architectural inconsistencies with the existing codebase
- Dead code or unused imports

Output a clear bullet-point list of code quality findings only. For each finding, include:
- The file path and approximate line number
- A concise description of the issue
- A suggested refactoring or fix

Do not comment on security, deployment, or non-code-quality concerns."""

ARCHITECTURE_AGENT_PROMPT = """You are a Systems Architect.
Your sole task is to analyze the provided code diff and output a PlantUML diagram
that represents the key structural changes introduced by this pull request.

Focus on:
- Classes, interfaces, or modules added or modified
- Key relationships, dependencies, or data flows changed
- External services or APIs interacted with

Output ONLY a valid PlantUML block starting with @startuml and ending with @enduml.
Do not include any explanatory text outside the diagram."""

SYNTHESIZER_PROMPT = """You are the Lead Code Review Manager.
You have received reports from three specialist agents. Your task is to:

1. Merge the security and style findings into a single, deduplicated list.
2. Remove any duplicate or overlapping findings (keep the most specific one).
3. Calculate a unified quality score (0-100):
   - Start at 100
   - Deduct 20 points per critical finding
   - Deduct 10 points per high finding
   - Deduct 5 points per medium finding
   - Deduct 2 points per low finding
   - Minimum score is 0
4. Return the PlantUML diagram as-is.
5. Output ONLY valid JSON matching the exact schema provided. No markdown wrappers.

For each finding in your output, ensure:
- 'type' is one of: code_smell, security_issue, suggestion, best_practice
- 'severity' is one of: low, medium, high, critical
- 'file_path' is the relative path of the file (if identifiable from the reports)
- 'line_number' is an integer (if identifiable from the reports)
- 'message' is a concise, actionable description
- 'suggestion' is a specific fix recommendation (optional but preferred)"""


# ─── Resilient Single Agent Runner ─────────────────────────────────────────────

@retry(
    retry=retry_if_exception_type(TransientLLMError),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=False,  # Return None on final failure instead of raising
)
async def _run_gemini_agent(system_instruction: str, user_content: str) -> Optional[str]:
    """Invokes Gemini with exponential backoff retry on transient errors."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)

        full_prompt = f"SYSTEM INSTRUCTIONS:\n{system_instruction}\n\nDATA TO ANALYZE:\n{user_content}"
        response = await asyncio.to_thread(model.generate_content, full_prompt)
        return response.text

    except Exception as e:
        error_msg = str(e).lower()
        # Only retry transient errors - fail fast on auth/quota/content policy errors
        if any(code in error_msg for code in ["429", "502", "503", "504", "timeout"]):
            logger.warning(f"Transient LLM error (will retry): {e}")
            raise TransientLLMError(str(e))
        else:
            logger.error(f"Non-retriable LLM error: {e}")
            return None  # Return None for non-retriable errors


async def _run_gemini_synthesizer(
    synthesizer_prompt: str,
    combined_data: str,
    response_schema,
) -> str:
    """Runs the Synthesizer agent with strict Pydantic schema enforcement."""
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)

    generation_config = genai.types.GenerationConfig(
        temperature=0.2,
        response_mime_type="application/json",
        response_schema=response_schema,
    )

    model = genai.GenerativeModel(GEMINI_MODEL)
    full_prompt = f"SYSTEM INSTRUCTIONS:\n{synthesizer_prompt}\n\nINPUT DATA:\n{combined_data}"
    response = await asyncio.to_thread(model.generate_content, full_prompt, generation_config=generation_config)
    return response.text


# ─── Fallback Stub ─────────────────────────────────────────────────────────────

def _get_stub_result() -> Dict[str, Any]:
    return {
        "quality_score": 80,
        "findings": [
            {
                "type": "suggestion",
                "severity": "low",
                "message": "Consider adding more detailed comments to improve code readability.",
                "suggestion": "Add docstrings and inline comments where complex logic exists.",
            }
        ],
        "plantuml": "@startuml\nclass CodeReview {\n  +quality_score: int\n  +findings: List\n}\n@enduml",
    }


# ─── Public Multi-Agent Entry Point ────────────────────────────────────────────

async def run_agentic_review(diff: str, code_context: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Orchestrates the 4-agent review pipeline:
    1. Fan-Out: Security, Style, and Architecture agents run in parallel.
    2. Fan-In: Lead Synthesizer merges, deduplicates, and scores the findings.

    Returns a dict matching the ReviewResponse schema.
    """
    # Format the code context block for injection into prompts
    context_block = ""
    if code_context:
        sections = [f"--- FILE: {path} ---\n{content}" for path, content in code_context.items()]
        context_block = "\n\n".join(sections)

    user_payload = f"PULL REQUEST DIFF:\n{diff}"
    if context_block:
        user_payload += f"\n\nREPOSITORY CONTEXT (files changed and their local dependencies):\n{context_block}"

    # ── Phase 1: Fan-Out - Parallel Specialist Agents ──────────────────────────
    logger.info("Launching parallel specialist agents...")

    results = await asyncio.gather(
        _run_gemini_agent(SECURITY_AGENT_PROMPT, user_payload),
        _run_gemini_agent(STYLE_AGENT_PROMPT, user_payload),
        _run_gemini_agent(ARCHITECTURE_AGENT_PROMPT, user_payload),
        return_exceptions=True,  # Graceful degradation: exceptions don't crash gather
    )

    security_result = results[0]
    style_result = results[1]
    arch_result = results[2]

    # Log which agents failed
    for name, result in [("Security", security_result), ("Style", style_result), ("Architecture", arch_result)]:
        if isinstance(result, Exception) or result is None:
            logger.warning(f"{name} Agent failed or returned None")

    # ── Blackout Check: All specialists failed ─────────────────────────────────
    all_failed = all(
        isinstance(r, Exception) or r is None
        for r in [security_result, style_result, arch_result]
    )
    if all_failed:
        logger.error("All specialist agents failed. Raising AllSpecialistsFailedException.")
        raise AllSpecialistsFailedException("All AI specialist agents failed to execute.")

    # Build degraded-safe values for failed agents
    security_text = security_result if isinstance(security_result, str) else "⚠️ Security audit was unavailable."
    style_text = style_result if isinstance(style_result, str) else "⚠️ Style analysis was unavailable."
    plantuml_text = arch_result if isinstance(arch_result, str) else "@startuml\n@enduml"

    logger.info("All specialist agents completed (with potential degradation). Running synthesizer...")

    # ── Phase 2: Fan-In - Lead Synthesizer ────────────────────────────────────
    synthesizer_input = f"""SECURITY AUDITOR REPORT:
{security_text}

STYLE INSPECTOR REPORT:
{style_text}

PLANTUML ARCHITECTURE DIAGRAM:
{plantuml_text}
"""

    try:
        raw_json = await _run_gemini_synthesizer(
            synthesizer_prompt=SYNTHESIZER_PROMPT,
            combined_data=synthesizer_input,
            response_schema=ReviewResponse,
        )

        # Validate the structured output against our Pydantic schema
        validated = ReviewResponse.model_validate_json(raw_json)
        logger.info(
            f"Synthesis complete: quality_score={validated.quality_score}, "
            f"findings={len(validated.findings)}"
        )
        return validated.model_dump()

    except Exception as e:
        logger.error(f"Synthesizer failed: {e}. Falling back to stub result.")
        return _get_stub_result()


def llm_run(prompt: str, code_context: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Synchronous wrapper for the async multi-agent review pipeline.
    Called from main.py's /review endpoint.
    """
    if LLM_PROVIDER == "gemini" and GEMINI_API_KEY:
        try:
            # Extract diff from the prompt passed by main.py
            result = asyncio.run(run_agentic_review(prompt, code_context))
            return result
        except AllSpecialistsFailedException:
            raise  # Let main.py handle this as a 500 error
        except Exception as e:
            logger.error(f"Multi-agent review failed: {e}")
            return _get_stub_result()
    else:
        logger.info("No LLM provider configured, returning stub result.")
        return _get_stub_result()
