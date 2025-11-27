#!/usr/bin/env node

/**
 * Simple test for metrics generation without cloning
 */

import { generateMetrics } from './src/metrics';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

async function testMetricsSimple() {
  console.log('Testing metrics generation (simple test)...');
  console.log('='.repeat(60));

  // Create a temporary test directory with sample files
  const testDir = path.join(os.tmpdir(), 'test-metrics-' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });

  // Create a sample JavaScript file
  const testFile = path.join(testDir, 'test.js');
  const testContent = `
function complexFunction(x, y) {
  if (x > 0) {
    for (let i = 0; i < y; i++) {
      if (i % 2 === 0) {
        console.log('even');
      } else {
        console.log('odd');
      }
    }
  }
  return x + y;
}
`;
  fs.writeFileSync(testFile, testContent);

  console.log(`Created test file: ${testFile}`);
  console.log('Generating metrics...\n');

  try {
    const result = await generateMetrics(testDir);

    // Output JSON
    console.log('Metrics Result:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(60));

    // Verify structure
    if (result.file_metrics && Array.isArray(result.file_metrics)) {
      console.log('\n[SUCCESS] Metrics generated successfully!');
      console.log(`  Files analyzed: ${result.counts.files_analyzed}`);
      console.log(`  Total issues: ${result.counts.issues}`);
      console.log(`  Errors: ${result.counts.errors}`);
      console.log(`  Warnings: ${result.counts.warnings}`);
      
      if (result.file_metrics.length > 0) {
        const firstFile = result.file_metrics[0];
        console.log(`\n  First file: ${firstFile.file_path}`);
        console.log(`    Language: ${firstFile.language}`);
        console.log(`    Issues: ${firstFile.issues}`);
        console.log(`    Complexity: ${firstFile.cyclomatic_complexity}`);
        console.log(`    Line count: ${firstFile.line_count}`);
      }
    } else {
      console.log('\n[ERROR] Invalid metrics structure - file_metrics is not an array');
      process.exit(1);
    }

    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('\nTest directory cleaned up');
  } catch (error: any) {
    console.error('\n[ERROR]', error.message);
    console.error(error.stack);
    // Cleanup on error
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    process.exit(1);
  }
}

if (require.main === module) {
  testMetricsSimple();
}

export {};

