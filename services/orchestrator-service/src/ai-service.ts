import axios from 'axios';
import config from './config';
import { aiLatencyMs } from './metrics';

const AI_SERVICE_URL = config.aiServiceUrl;

interface Finding {
  type: 'code_smell' | 'security_issue' | 'suggestion' | 'best_practice';
  severity: 'low' | 'medium' | 'high' | 'critical';
  file_path?: string;
  line_number?: number;
  message: string;
  suggestion?: string;
}

interface AIReviewRequest {
  diff: string;
  static_metrics?: any;
  code_context?: Record<string, string>;
}

interface AIReviewResponse {
  quality_score: number;
  findings: Finding[];
  plantuml: string;
  uml_s3_url: string | null;
}

export async function callAIService(
  diff: string,
  static_metrics?: any,
  code_context?: Record<string, string>
): Promise<AIReviewResponse> {
  const useMock = config.useMockAI;

  if (useMock) {
    console.log('[ai-service] Using mock AI response (USE_MOCK_AI=true)');
    return getMockAIResponse();
  }

  console.log(`[ai-service] Calling AI service at ${AI_SERVICE_URL}/review`);
  const startTime = Date.now();

  try {
    const requestBody: AIReviewRequest = { diff, static_metrics, code_context };

    const response = await axios.post<AIReviewResponse>(
      `${AI_SERVICE_URL}/review`,
      requestBody,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000, // 60s - multi-agent calls take longer than a single prompt
      }
    );

    const latency = Date.now() - startTime;
    aiLatencyMs.observe(latency);
    console.log(`[ai-service] Response received in ${latency}ms`);

    return response.data;
  } catch (error: any) {
    const latency = Date.now() - startTime;
    aiLatencyMs.observe(latency);

    console.error('[ai-service] Error calling AI service:', error.message);
    console.log('[ai-service] Falling back to mock AI response');
    return getMockAIResponse();
  }
}

function getMockAIResponse(): AIReviewResponse {
  return {
    quality_score: 82,
    findings: [
      {
        type: 'security_issue',
        severity: 'high',
        file_path: 'src/index.ts',
        line_number: 12,
        message: 'Potential SQL injection: user input is not sanitized before being interpolated.',
        suggestion: 'Use parameterized queries or an ORM instead of string interpolation.',
      },
      {
        type: 'code_smell',
        severity: 'medium',
        file_path: 'src/utils.ts',
        line_number: 34,
        message: 'Function has cyclomatic complexity of 14, exceeding the recommended limit of 10.',
        suggestion: 'Extract the nested conditional logic into smaller, named helper functions.',
      },
      {
        type: 'best_practice',
        severity: 'low',
        message: 'Good use of async/await and structured error handling.',
        suggestion: 'Continue following this pattern across all service layers.',
      },
    ],
    plantuml: '@startuml\nclass CodeReview {\n  +quality_score: int\n  +findings: List\n}\n@enduml',
    uml_s3_url: null,
  };
}
