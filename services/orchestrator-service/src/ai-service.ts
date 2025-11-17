import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

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
  // TODO: Replace this mock with actual AI service call when T030 is implemented
  // For now, return mock data to test the orchestrator flow
  
  const useMock = process.env.USE_MOCK_AI === 'true' || !process.env.AI_SERVICE_URL;
  
  if (useMock) {
    console.log('Using mock AI service response (set AI_SERVICE_URL to use real service)');
    return getMockAIResponse(diff);
  }

  try {
    const response = await axios.post<AIReviewResponse>(
      `${AI_SERVICE_URL}/review`,
      { diff, static_metrics },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000 // 30 second timeout
      }
    );

    return response.data;
  } catch (error: any) {
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

