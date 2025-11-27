// Simple test using compiled JavaScript
const { generateMetrics } = require('./dist/metrics');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function test() {
  const testDir = path.join(os.tmpdir(), 'test-simple-' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });

  // Create test file
  const testFile = path.join(testDir, 'test.js');
  fs.writeFileSync(testFile, 'function test() { if (true) { return 1; } }');

  try {
    const result = await generateMetrics(testDir);
    
    // Write result to file
    const outputFile = path.join(__dirname, 'test-result.json');
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    
    console.log('SUCCESS');
    console.log('Files analyzed:', result.counts.files_analyzed);
    console.log('Issues:', result.counts.issues);
    console.log('Result written to:', outputFile);
    
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch (error) {
    console.error('ERROR:', error.message);
    fs.rmSync(testDir, { recursive: true, force: true });
    process.exit(1);
  }
}

test();

