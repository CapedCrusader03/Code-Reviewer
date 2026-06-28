import * as fs from 'fs';
import * as path from 'path';

/**
 * Extracts full code context by reading modified files and recursively
 * resolving and reading their local relative imports.
 *
 * This allows the AI service to reason about the full compile-time context
 * of a change, not just the isolated diff lines.
 *
 * @param repoPath - Absolute path to the checked-out repository workspace.
 * @param changedFiles - List of relative file paths changed in the PR diff.
 * @returns A map of { relativePath: fileContent } for all relevant files.
 */
export function extractCodeContext(
  repoPath: string,
  changedFiles: string[]
): Record<string, string> {
  const context: Record<string, string> = {};
  const processedFiles = new Set<string>();

  function resolveAndReadFile(relativePath: string): void {
    const fullPath = path.resolve(repoPath, relativePath);

    // Avoid circular imports and missing files
    if (processedFiles.has(fullPath)) return;
    if (!fs.existsSync(fullPath)) {
      console.warn(`[context-extractor] File not found: ${fullPath}`);
      return;
    }

    processedFiles.add(fullPath);

    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch (err: any) {
      console.warn(`[context-extractor] Could not read ${fullPath}: ${err.message}`);
      return;
    }

    // Store using normalized relative path as key
    const normalizedRelative = path.relative(repoPath, fullPath).replace(/\\/g, '/');
    context[normalizedRelative] = content;

    // Regex to find ES module and CommonJS local relative imports
    // Matches: import ... from './x', import ... from '../x', require('./x'), require('../x')
    const importRegex = /(?:import|require)\s*\(?\s*['"](\.[^'"]+)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(content)) !== null) {
      const importRef = match[1];
      const currentDir = path.dirname(fullPath);

      // Try resolving the import with common code file extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
      let resolved = false;

      for (const ext of extensions) {
        // First try the import as-is with the extension appended
        const candidate = path.resolve(currentDir, importRef + ext);
        if (fs.existsSync(candidate)) {
          const rel = path.relative(repoPath, candidate).replace(/\\/g, '/');
          resolveAndReadFile(rel);
          resolved = true;
          break;
        }

        // Also try resolving as a directory index file (e.g. './utils' -> './utils/index.ts')
        const indexCandidate = path.resolve(currentDir, importRef, `index${ext}`);
        if (fs.existsSync(indexCandidate)) {
          const rel = path.relative(repoPath, indexCandidate).replace(/\\/g, '/');
          resolveAndReadFile(rel);
          resolved = true;
          break;
        }
      }

      if (!resolved) {
        console.debug(`[context-extractor] Could not resolve import: ${importRef} from ${relativePath}`);
      }
    }
  }

  // Seed the traversal with all changed files in the PR
  for (const file of changedFiles) {
    resolveAndReadFile(file);
  }

  console.log(`[context-extractor] Extracted context for ${Object.keys(context).length} files`);
  return context;
}
