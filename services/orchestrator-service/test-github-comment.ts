// Test script to verify GitHub comment formatting
import { postGitHubComment } from './github-service';

const testReviewData = {
  review_id: 1,
  repo: 'octocat/Hello-World',
  pr_number: 42,
  quality_score: 85,
  findings: [
    {
      type: 'code_smell',
      severity: 'high',
      file_path: 'src/main.ts',
      line_number: 42,
      message: 'Complex function with high cyclomatic complexity',
      suggestion: 'Consider breaking this into smaller functions'
    },
    {
      type: 'security_issue',
      severity: 'critical',
      file_path: 'src/auth.ts',
      line_number: 15,
      message: 'Potential SQL injection vulnerability',
      suggestion: 'Use parameterized queries'
    },
    {
      type: 'suggestion',
      severity: 'low',
      file_path: 'README.md',
      line_number: 1,
      message: 'Consider adding more documentation',
      suggestion: 'Add usage examples'
    },
    {
      type: 'best_practice',
      severity: 'medium',
      message: 'Good error handling patterns',
      suggestion: 'Continue following this pattern'
    }
  ]
};

console.log('Testing GitHub comment formatting...\n');

// This will format the comment but won't post if no token
postGitHubComment(testReviewData)
  .then((commentId) => {
    if (commentId) {
      console.log(`✅ Comment posted! ID: ${commentId}`);
    } else {
      console.log('ℹ️  Comment not posted (no GITHUB_TOKEN set - this is expected in test)');
      console.log('\nTo test with real GitHub:');
      console.log('1. Set GITHUB_TOKEN environment variable');
      console.log('2. Ensure the token has repo permissions');
      console.log('3. Run the orchestrator service');
    }
  })
  .catch((error) => {
    console.error('Error:', error.message);
  });

