import { ESLint } from "eslint";
import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';

interface FileMetric {
  file_path: string;
  language: string;
  issues: number;
  cyclomatic_complexity?: number;
  line_count?: number;
  errors: number;
  warnings: number;
}

interface MetricsResult {
  file_metrics: FileMetric[];
  counts: {
    issues: number;
    errors: number;
    warnings: number;
    files_analyzed: number;
  };
}

/**
 * Simple cyclomatic complexity counter for JavaScript/TypeScript.
 * Counts decision points: if, for, while, switch, catch, &&, ||, ?:
 */
function calculateCyclomaticComplexity(content: string): number {
  const patterns = [
    /\bif\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bswitch\s*\(/g,
    /\bcatch\s*\(/g,
    /&&/g,
    /\|\|/g,
    /\?/g,
  ];

  let complexity = 1; // Base complexity
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Get language from file extension
 */
function getLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: { [key: string]: string } = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.java': 'java',
    '.py': 'python',
  };
  return langMap[ext] || 'unknown';
}

/**
 * Run ESLint on a file
 */
async function runESLint(filePath: string, language: string): Promise<{ errors: number; warnings: number; issues: number }> {
  try {
    // Determine parser based on file type
    const isTypeScript = language === 'typescript';
    const parser = isTypeScript ? '@typescript-eslint/parser' : undefined;
    const plugins = isTypeScript ? ['@typescript-eslint'] : [];

    const eslintConfig: any = {
      useEslintrc: false,
      baseConfig: {
        parserOptions: {
          ecmaVersion: 2020,
          sourceType: 'module',
        },
        rules: {
          // Basic rules for demonstration
          'no-unused-vars': 'warn',
          'no-console': 'off', // Allow console for now
        },
      },
    };

    // Only add TypeScript-specific config for TS files
    if (isTypeScript) {
      eslintConfig.baseConfig.parser = parser;
      eslintConfig.baseConfig.plugins = plugins;
    }

    const eslint = new ESLint(eslintConfig);

    const results = await eslint.lintFiles([filePath]);
    const result = results[0];

    if (!result) {
      return { errors: 0, warnings: 0, issues: 0 };
    }

    const errors = result.errorCount;
    const warnings = result.warningCount;
    const issues = errors + warnings;

    return { errors, warnings, issues };
  } catch (error: any) {
    // If ESLint fails (e.g., no config, parser issues), return zeros
    console.warn(`ESLint failed for ${filePath}: ${error.message}`);
    return { errors: 0, warnings: 0, issues: 0 };
  }
}

/**
 * Analyze a single file and return metrics
 */
async function analyzeFile(filePath: string, repoPath: string): Promise<FileMetric | null> {
  // Handle both absolute and relative paths
  const fullPath = path.isAbsolute(filePath) 
    ? filePath 
    : path.join(repoPath, filePath);

  if (!fs.existsSync(fullPath)) {
    console.warn(`File not found: ${fullPath}`);
    return null;
  }

  const language = getLanguage(filePath);
  
  // Only analyze JS/TS files with ESLint for MVP
  if (language !== 'javascript' && language !== 'typescript') {
    // For other languages, return basic metrics
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n').length;
    return {
      file_path: filePath,
      language,
      issues: 0,
      cyclomatic_complexity: 0,
      line_count: lines,
      errors: 0,
      warnings: 0,
    };
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n').length;
    const complexity = calculateCyclomaticComplexity(content);
    const lintResult = await runESLint(fullPath, language);

    return {
      file_path: filePath,
      language,
      issues: lintResult.issues,
      cyclomatic_complexity: complexity,
      line_count: lines,
      errors: lintResult.errors,
      warnings: lintResult.warnings,
    };
  } catch (error: any) {
    console.error(`Error analyzing ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Get list of changed files from git diff
 */
async function getChangedFiles(repoPath: string, baseSha: string, headSha: string): Promise<string[]> {
  try {
    const git = simpleGit(repoPath);
    const diff = await git.diff([baseSha, headSha, '--name-only']);
    return diff.split('\n').filter((file: string) => file.trim().length > 0);
  } catch (error: any) {
    console.error(`Error getting changed files: ${error.message}`);
    return [];
  }
}

/**
 * Find all code files in a directory recursively
 */
function findCodeFiles(dir: string, extensions: string[] = ['.js', '.jsx', '.ts', '.tsx', '.java', '.py']): string[] {
  const files: string[] = [];
  const baseDir = path.resolve(dir);
  
  function walk(currentPath: string) {
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip node_modules, .git, and other common ignore directories
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            // Get relative path from base directory
            const relPath = path.relative(baseDir, fullPath);
            // Normalize path separators to forward slashes for consistency
            files.push(relPath.split(path.sep).join('/'));
          }
        }
      }
    } catch (error: any) {
      // Skip directories we can't read
      console.warn(`Cannot read directory ${currentPath}: ${error.message}`);
    }
  }
  
  walk(baseDir);
  return files;
}

/**
 * Analyze changed files and generate metrics
 */
export async function generateMetrics(
  repoPath: string,
  baseSha?: string,
  headSha?: string
): Promise<MetricsResult> {
  let filesToAnalyze: string[] = [];

  if (baseSha && headSha) {
    // Analyze only changed files
    filesToAnalyze = await getChangedFiles(repoPath, baseSha, headSha);
  } else {
    // Analyze all code files in repo
    filesToAnalyze = findCodeFiles(repoPath);
  }

  const fileMetrics: FileMetric[] = [];
  let totalIssues = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of filesToAnalyze) {
    const metric = await analyzeFile(file, repoPath);
    if (metric) {
      fileMetrics.push(metric);
      totalIssues += metric.issues;
      totalErrors += metric.errors;
      totalWarnings += metric.warnings;
    }
  }

  return {
    file_metrics: fileMetrics,
    counts: {
      issues: totalIssues,
      errors: totalErrors,
      warnings: totalWarnings,
      files_analyzed: fileMetrics.length,
    },
  };
}

