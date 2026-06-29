// Script to trigger a real code review on our buggy utility change
// Loads env variables, generates actual git diff, and triggers webhook.

const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');
const mysql = require('mysql2/promise');

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'my_review_webhook_secret_2026';
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3308'),
  user: process.env.DB_USER || 'reviewer',
  password: process.env.DB_PASSWORD || 'reviewerpass',
  database: process.env.DB_NAME || 'code_reviewer'
};

function computeSignature(body, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  return `sha256=${hmac.digest('hex')}`;
}

async function sendWebhook(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const signature = computeSignature(body, WEBHOOK_SECRET);
    
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/github/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'pull_request',
        'X-Hub-Signature-256': signature,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ status: res.statusCode, body: response });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getReviewStatus(connection, jobId) {
  const [reviews] = await connection.execute(
    'SELECT * FROM reviews WHERE job_id = ?',
    [jobId]
  );
  if (reviews.length === 0) return null;
  const review = reviews[0];

  const [findings] = await connection.execute(
    'SELECT * FROM findings WHERE review_id = ?',
    [review.id]
  );

  return { review, findings };
}

async function run() {
  console.log('============================================================');
  console.log('Triggering Real Code Review on local workspace...');
  console.log('============================================================\n');

  let connection;
  try {
    // 1. Get current commit SHA
    const commitSha = execSync('git rev-parse HEAD').toString().trim();
    console.log(`Current Commit SHA: ${commitSha}`);

    // 2. Get git diff of the entire PR branch changes compared to main
    // Using forward slashes for Windows paths compatibility in Node
    const diff = execSync('git diff main...HEAD').toString();
    console.log(`Generated diff of changes (${diff.length} chars)\n`);

    // 3. Connect to local database
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('Connected to MySQL database.');

    // 4. Construct payload (pointing repo to local workspace path)
    const localRepoPath = 'C:/Users/kshit/Desktop/Code-Reviewer';
    const payload = {
      action: 'opened',
      pull_request: {
        number: 42,
        head: {
          sha: commitSha
        }
      },
      repository: {
        full_name: localRepoPath
      },
      diff: diff // Send actual diff so webhook service uses it directly
    };

    // 5. Send webhook request
    console.log('Sending webhook to Webhook service...');
    const response = await sendWebhook(payload);
    
    if (response.status !== 202 || !response.body.job_id) {
      throw new Error(`Webhook request failed: ${JSON.stringify(response)}`);
    }
    
    const jobId = response.body.job_id;
    console.log(`Webhook accepted! Job ID: ${jobId}`);
    console.log('Waiting for Orchestrator and AI Service to process...');

    // 6. Poll database for results (checks every 2 seconds for up to 60 seconds)
    let attempts = 0;
    const maxAttempts = 30;
    let completed = false;

    while (attempts < maxAttempts && !completed) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;
      
      const result = await getReviewStatus(connection, jobId);
      if (!result || !result.review) {
        console.log(`[${attempts * 2}s] Waiting for review to be initialized...`);
        continue;
      }

      console.log(`[${attempts * 2}s] Job Status: ${result.review.status}`);

      if (result.review.status === 'done') {
        completed = true;
        console.log('\n============================================================');
        console.log('🎉 REVIEW COMPLETED SUCCESSFULLY!');
        console.log('============================================================');
        console.log(`Quality Score: ${result.review.quality_score}/100`);
        console.log(`Findings Detected: ${result.findings.length}`);
        console.log('------------------------------------------------------------');
        
        result.findings.forEach((finding, idx) => {
          console.log(`${idx + 1}. [${finding.type.toUpperCase()} - ${finding.severity.toUpperCase()}]`);
          console.log(`   File: ${finding.file_path}:${finding.line_number}`);
          console.log(`   Issue: ${finding.message}`);
          if (finding.suggestion) {
            console.log(`   Suggestion:\n${finding.suggestion}`);
          }
          console.log('------------------------------------------------------------');
        });
      } else if (result.review.status === 'failed') {
        throw new Error('Review job failed in Orchestrator pipeline.');
      }
    }

    if (!completed) {
      console.log('\nTimeout exceeded waiting for review to complete.');
    }

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
}

run();
