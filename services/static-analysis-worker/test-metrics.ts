#!/usr/bin/env node

/**
 * Test script for metrics generation
 */

import { generateMetrics } from './src/metrics';
import { cloneRepo } from './src/git-utils';
import * as path from 'path';
import * as fs from 'fs';

async function testMetrics() {
  const testRepo = 'octocat/Hello-World';
  const testSha = '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d';
  const testDest = path.join(__dirname, 'test-metrics-repo');

  console.log('Testing metrics generation...');
  console.log('='.repeat(60));

  try {
    // Clone repo
    console.log('1. Cloning repository...');
    await cloneRepo(testRepo, testSha, testDest);

    // Generate metrics
    console.log('\n2. Generating metrics...');
    const result = await generateMetrics(testDest);

    // Output JSON
    console.log('\n3. Metrics Result:');
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
    } else {
      console.log('\n[ERROR] Invalid metrics structure');
      process.exit(1);
    }

    // Cleanup
    if (fs.existsSync(testDest)) {
      fs.rmSync(testDest, { recursive: true, force: true });
      console.log('\nTest directory cleaned up');
    }
  } catch (error: any) {
    console.error('\n[ERROR]', error.message);
    if (fs.existsSync(testDest)) {
      fs.rmSync(testDest, { recursive: true, force: true });
    }
    process.exit(1);
  }
}

if (require.main === module) {
  testMetrics();
}

export {};

