// Test script for HMAC signature verification
const crypto = require('crypto');
const http = require('http');

const SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'default-secret';
const PORT = 4000;

function computeSignature(body, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  return `sha256=${hmac.digest('hex')}`;
}

function sendRequest(signature, body) {
  const data = body;
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/github/webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
      'X-Hub-Signature-256': signature
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    res.on('data', (chunk) => {
      console.log(`Response: ${chunk}`);
    });
  });

  req.on('error', (e) => {
    console.error(`Error: ${e.message}`);
  });

  req.write(data);
  req.end();
}

console.log('Testing webhook signature verification...\n');

// Test 1: Invalid signature
console.log('Test 1: Invalid signature');
const body1 = JSON.stringify({});
sendRequest('sha256=invalidsignature', body1);

setTimeout(() => {
  // Test 2: Valid signature
  console.log('\nTest 2: Valid signature');
  const body2 = JSON.stringify({});
  const validSignature = computeSignature(body2, SECRET);
  console.log(`Computed signature: ${validSignature}`);
  sendRequest(validSignature, body2);
}, 1000);

setTimeout(() => {
  // Test 3: No signature
  console.log('\nTest 3: No signature (empty header)');
  sendRequest('', JSON.stringify({}));
}, 2000);

