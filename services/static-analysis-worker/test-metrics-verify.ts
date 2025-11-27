#!/usr/bin/env node

/**
 * Simple verification test for T042 - Metrics Generation
 * Creates test files and verifies the metrics output structure
 */

import { generateMetrics } from './src/metrics';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

async function verifyMetrics() {
  console.log('='.repeat(70));
  console.log('T042 Verification Test - Metrics Generation');
  console.log('='.repeat(70));
  console.log('');

  // Create a temporary test directory
  const testDir = path.join(os.tmpdir(), 'test-metrics-verify-' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });

  console.log(`Test directory: ${testDir}`);
  console.log('');

  try {
    // Create test JavaScript file with some complexity
    const jsFile = path.join(testDir, 'test.js');
    const jsContent = `
// Test JavaScript file
function complexFunction(x, y) {
  if (x > 0) {
    for (let i = 0; i < y; i++) {
      if (i % 2 === 0 && i > 10) {
        console.log('even and > 10');
      } else {
        console.log('other');
      }
    }
  }
  return x ? y : 0;
}

const unused = 42; // This should trigger a warning
`;
    fs.writeFileSync(jsFile, jsContent);
    console.log('✓ Created test.js');

    // Create test TypeScript file
    const tsFile = path.join(testDir, 'test.ts');
    const tsContent = `
// Test TypeScript file
interface Test {
  value: number;
}

function simpleFunction(x: number): number {
  return x * 2;
}
`;
    fs.writeFileSync(tsFile, tsContent);
    console.log('✓ Created test.ts');

    // Create a Python file (should get basic metrics only)
    const pyFile = path.join(testDir, 'test.py');
    const pyContent = `# Test Python file
def hello():
    print("Hello World")
`;
    fs.writeFileSync(pyFile, pyContent);
    console.log('✓ Created test.py');
    console.log('');

    // Generate metrics
    console.log('Generating metrics...');
    console.log('-'.repeat(70));
    const result = await generateMetrics(testDir);

    // Display results
    console.log('\nMetrics Result:');
    console.log('='.repeat(70));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(70));
    console.log('');

    // Verify structure
    console.log('Verification:');
    console.log('-'.repeat(70));
    
    let allPassed = true;

    // Check 1: file_metrics exists and is an array
    if (result.file_metrics && Array.isArray(result.file_metrics)) {
      console.log('✓ file_metrics is an array');
    } else {
      console.log('✗ file_metrics is missing or not an array');
      allPassed = false;
    }

    // Check 2: counts object exists
    if (result.counts && typeof result.counts === 'object') {
      console.log('✓ counts object exists');
    } else {
      console.log('✗ counts object is missing');
      allPassed = false;
    }

    // Check 3: Required count fields
    const requiredCountFields = ['issues', 'errors', 'warnings', 'files_analyzed'];
    for (const field of requiredCountFields) {
      if (field in result.counts) {
        console.log(`✓ counts.${field} exists`);
      } else {
        console.log(`✗ counts.${field} is missing`);
        allPassed = false;
      }
    }

    // Check 4: Files were analyzed
    if (result.counts.files_analyzed > 0) {
      console.log(`✓ Files analyzed: ${result.counts.files_analyzed}`);
    } else {
      console.log('✗ No files were analyzed');
      allPassed = false;
    }

    // Check 5: File metrics structure
    if (result.file_metrics.length > 0) {
      const firstFile = result.file_metrics[0];
      const requiredFileFields = ['file_path', 'language', 'issues', 'errors', 'warnings'];
      for (const field of requiredFileFields) {
        if (field in firstFile) {
          console.log(`✓ file_metrics[0].${field} exists`);
        } else {
          console.log(`✗ file_metrics[0].${field} is missing`);
          allPassed = false;
        }
      }

      // Check for JS/TS specific fields
      const jsFileMetric = result.file_metrics.find(f => f.file_path.includes('.js'));
      if (jsFileMetric) {
        if (jsFileMetric.cyclomatic_complexity !== undefined) {
          console.log(`✓ cyclomatic_complexity calculated: ${jsFileMetric.cyclomatic_complexity}`);
        } else {
          console.log('✗ cyclomatic_complexity not calculated for JS file');
          allPassed = false;
        }
      }
    }

    console.log('');
    console.log('='.repeat(70));
    if (allPassed) {
      console.log('[SUCCESS] All verifications passed!');
      console.log('='.repeat(70));
      console.log('\nSummary:');
      console.log(`  Files analyzed: ${result.counts.files_analyzed}`);
      console.log(`  Total issues: ${result.counts.issues}`);
      console.log(`  Errors: ${result.counts.errors}`);
      console.log(`  Warnings: ${result.counts.warnings}`);
      
      if (result.file_metrics.length > 0) {
        console.log('\nFile details:');
        result.file_metrics.forEach(metric => {
          console.log(`  ${metric.file_path}:`);
          console.log(`    Language: ${metric.language}`);
          console.log(`    Issues: ${metric.issues}`);
          if (metric.cyclomatic_complexity !== undefined) {
            console.log(`    Complexity: ${metric.cyclomatic_complexity}`);
          }
          console.log(`    Lines: ${metric.line_count || 'N/A'}`);
        });
      }
    } else {
      console.log('[FAILURE] Some verifications failed!');
      console.log('='.repeat(70));
      process.exit(1);
    }

    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('\n✓ Test directory cleaned up');

  } catch (error: any) {
    console.error('\n[ERROR] Test failed with exception:');
    console.error(error.message);
    console.error(error.stack);
    
    // Cleanup on error
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    process.exit(1);
  }
}

if (require.main === module) {
  verifyMetrics();
}

export {};

