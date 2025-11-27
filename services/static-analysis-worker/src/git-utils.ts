import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Clone a repository and checkout a specific commit SHA.
 * 
 * @param repo - Repository URL (e.g., 'https://github.com/user/repo.git' or 'user/repo')
 * @param sha - Commit SHA to checkout
 * @param dest - Destination directory path
 * @returns Promise that resolves when clone and checkout are complete
 */
export async function cloneRepo(repo: string, sha: string, dest: string): Promise<void> {
  // Normalize repo URL
  let repoUrl = repo;
  if (!repoUrl.startsWith('http://') && !repoUrl.startsWith('https://') && !repoUrl.startsWith('git@')) {
    // Assume GitHub format: user/repo
    repoUrl = `https://github.com/${repo}.git`;
  }

  // Ensure destination directory exists
  const destPath = path.resolve(dest);
  if (fs.existsSync(destPath)) {
    // Remove existing directory if it exists
    fs.rmSync(destPath, { recursive: true, force: true });
  }
  fs.mkdirSync(destPath, { recursive: true });

  const git: SimpleGit = simpleGit();

  try {
    // Clone the repository
    console.log(`Cloning ${repoUrl} to ${destPath}...`);
    await git.clone(repoUrl, destPath);

    // Checkout the specific SHA
    const repoGit = simpleGit(destPath);
    console.log(`Checking out commit ${sha}...`);
    await repoGit.checkout(sha);

    // Verify the checkout
    const currentSha = await repoGit.revparse(['HEAD']);
    if (currentSha.trim() !== sha) {
      throw new Error(`Failed to checkout SHA ${sha}. Current HEAD is ${currentSha.trim()}`);
    }

    console.log(`Successfully cloned and checked out ${sha} to ${destPath}`);
  } catch (error: any) {
    // Clean up on error
    if (fs.existsSync(destPath)) {
      fs.rmSync(destPath, { recursive: true, force: true });
    }
    throw new Error(`Failed to clone repo ${repoUrl} at SHA ${sha}: ${error.message}`);
  }
}

