import axios from 'axios';
import config from './config';
import { aiLatencyMs } from './metrics';

const AI_SERVICE_URL = config.aiServiceUrl;

interface AIReviewRequest {
  diff: string;
  static_metrics?: any;
}

interface Finding {
  type: 'code_smell' | 'security_issue' | 'suggestion' | 'best_practice';
  severity: 'low' | 'medium' | 'high' | 'critical';
  file_path?: string;
  line_number?: number;
  message: string;
  suggestion?: string;
}

interface AIReviewResponse {
  quality_score: number;
  findings: Finding[];
  plantuml: string;
  uml_s3_url: string | null;
}

export async function callAIService(diff: string, static_metrics?: any): Promise<AIReviewResponse> {
  // Check if mock mode is explicitly enabled
  const useMock = config.useMockAI;
  
  if (useMock) {
    console.log('Using mock AI service response (USE_MOCK_AI=true)');
    return getMockAIResponse(diff);
  }
  
  // Use the AI service URL (defaults to http://localhost:8001)
  console.log(`Calling AI service at ${AI_SERVICE_URL}/review`);

  // Start timing for metrics
  const startTime = Date.now();

  try {
    const response = await axios.post<AIReviewResponse>(
      `${AI_SERVICE_URL}/review`,
      { diff, static_metrics },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000 // 30 second timeout
      }
    );

    // Record latency in milliseconds
    const latency = Date.now() - startTime;
    aiLatencyMs.observe(latency);

    return response.data;
  } catch (error: any) {
    // Record latency even on error
    const latency = Date.now() - startTime;
    aiLatencyMs.observe(latency);

    console.error('Error calling AI service:', error.message);
    // Fallback to mock on error
    console.log('Falling back to mock AI response');
    return getMockAIResponse(diff);
  }
}

function getMockAIResponse(diff: string): AIReviewResponse {
  return {
    quality_score: 85,
    findings: [
      {
        type: 'code_smell',
        severity: 'medium',
        file_path: 'README.md',
        line_number: 5,
        message: 'Consider adding more detailed documentation',
        suggestion: 'Add examples and usage instructions to improve clarity'
      },
      {
        type: 'best_practice',
        severity: 'low',
        message: 'Good use of clear commit messages',
        suggestion: 'Continue following conventional commit format'
      },
      {
        type: 'suggestion',
        severity: 'low',
        file_path: 'README.md',
        line_number: 1,
        message: 'Consider adding a table of contents for better navigation',
        suggestion: 'Add ToC links for sections'
      }
    ],
    plantuml: '@startuml\nclass CodeReview {\n  +quality_score: int\n  +findings: List\n}\n@enduml',
    uml_s3_url: null
  };
}

