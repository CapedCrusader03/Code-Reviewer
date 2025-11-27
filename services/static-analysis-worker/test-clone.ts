#!/usr/bin/env node

/**
 * Test script for clone_repo function
 */

import { cloneRepo } from './src/git-utils';
import * as path from 'path';
import * as fs from 'fs';
import simpleGit from 'simple-git';

async function testClone() {
  // Test with a small public repo
  const testRepo = 'octocat/Hello-World';
  const testSha = '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d'; // A known commit from Hello-World
  const testDest = path.join(__dirname, 'test-clone-dest');

  console.log('Testing clone_repo function...');
  console.log(`Repo: ${testRepo}`);
  console.log(`SHA: ${testSha}`);
  console.log(`Destination: ${testDest}`);
  console.log('');

  try {
    // Clone the repo
    await cloneRepo(testRepo, testSha, testDest);

    // Verify the SHA
    const git = simpleGit(testDest);
    const currentSha = await git.revparse(['HEAD']);
    const trimmedSha = currentSha.trim();

    console.log('');
    console.log('Verification:');
    console.log(`  Expected SHA: ${testSha}`);
    console.log(`  Current HEAD: ${trimmedSha}`);

    if (trimmedSha === testSha) {
      console.log('');
      console.log('[SUCCESS] Clone and checkout verified!');
      console.log(`  git rev-parse HEAD = ${trimmedSha}`);
    } else {
      console.log('');
      console.log('[ERROR] SHA mismatch!');
      process.exit(1);
    }

    // Cleanup
    if (fs.existsSync(testDest)) {
      fs.rmSync(testDest, { recursive: true, force: true });
      console.log('Test directory cleaned up');
    }
  } catch (error: any) {
    console.error('[ERROR]', error.message);
    // Cleanup on error
    if (fs.existsSync(testDest)) {
      fs.rmSync(testDest, { recursive: true, force: true });
    }
    process.exit(1);
  }
}

if (require.main === module) {
  testClone();
}

export {};

