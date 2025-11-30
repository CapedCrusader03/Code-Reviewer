/**
 * Centralized configuration loader for webhook-service
 * Validates required environment variables and exports typed config
 */

interface WebhookConfig {
  port: number;
  webhookSecret: string;
  githubToken: string;
  kafkaBroker: string;
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    console.error(`❌ Required environment variable ${name} is not set`);
    console.error(`   Please set ${name} before starting the service`);
    process.exit(1);
  }
  return value || defaultValue!;
}

function getEnvVarAsNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    console.error(`❌ Environment variable ${name} must be a valid number, got: ${value}`);
    process.exit(1);
  }
  return num;
}

export function loadConfig(): WebhookConfig {
  // KAFKA_BROKER is required (no default for production)
  // Other vars have defaults for local development
  return {
    port: getEnvVarAsNumber('PORT', 4000),
    webhookSecret: getEnvVar('GITHUB_WEBHOOK_SECRET', 'default-secret'),
    githubToken: getEnvVar('GITHUB_TOKEN', ''), // Optional, but warn if not set
    kafkaBroker: getEnvVar('KAFKA_BROKER', 'localhost:9092') // Has default for local dev
  };
}

// Validate and export config
const config = loadConfig();

// Warn if GITHUB_TOKEN is not set (needed for fetching file contents)
if (!config.githubToken) {
  console.warn('⚠️  GITHUB_TOKEN is not set. File content fetching from GitHub API will not work.');
  console.warn('   Set GITHUB_TOKEN to enable fetching file contents for binary file diffs.');
}

export default config;

