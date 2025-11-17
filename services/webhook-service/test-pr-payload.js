// Test script for pull_request event parsing
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'default-secret';
const PORT = 4000;

function computeSignature(body, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  return `sha256=${hmac.digest('hex')}`;
}

// Read the test payload
const payload = fs.readFileSync(path.join(__dirname, 'test-pr-event.json'), 'utf8');
const signature = computeSignature(payload, SECRET);

console.log('Sending pull_request event to webhook...\n');
console.log('Payload preview:', JSON.parse(payload).repository.full_name);

const options = {
  hostname: 'localhost',
  port: PORT,
  path: '/github/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length,
    'X-Hub-Signature-256': signature,
    'X-GitHub-Event': 'pull_request'
  }
};

const req = http.request(options, (res) => {
  console.log(`\nStatus: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(`Response: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
});

req.write(payload);
req.end();

