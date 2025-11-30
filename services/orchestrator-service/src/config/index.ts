/**
 * Centralized configuration loader for orchestrator-service
 * Validates required environment variables and exports typed config
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface OrchestratorConfig {
  port: number;
  corsOrigin: string;
  kafkaBroker: string;
  kafkaGroupId: string;
  aiServiceUrl: string;
  useMockAI: boolean;
  githubToken: string;
  database: DatabaseConfig;
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

function getEnvVarAsBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

export function loadConfig(): OrchestratorConfig {
  return {
    port: getEnvVarAsNumber('PORT', 5000),
    corsOrigin: getEnvVar('CORS_ORIGIN', 'http://localhost:3000'),
    kafkaBroker: getEnvVar('KAFKA_BROKER', 'localhost:9092'),
    kafkaGroupId: getEnvVar('KAFKA_GROUP_ID', 'orchestrator-service'),
    aiServiceUrl: getEnvVar('AI_SERVICE_URL', 'http://localhost:8001'),
    useMockAI: getEnvVarAsBoolean('USE_MOCK_AI', false),
    githubToken: getEnvVar('GITHUB_TOKEN', ''), // Optional
    database: {
      host: getEnvVar('DB_HOST', 'localhost'),
      port: getEnvVarAsNumber('DB_PORT', 3308),
      user: getEnvVar('DB_USER', 'reviewer'),
      password: getEnvVar('DB_PASSWORD', 'reviewerpass'),
      database: getEnvVar('DB_NAME', 'code_reviewer')
    }
  };
}

// Validate and export config
const config = loadConfig();

// Warn if GITHUB_TOKEN is not set (needed for posting comments)
if (!config.githubToken) {
  console.warn('⚠️  GITHUB_TOKEN is not set. GitHub comment posting will be skipped.');
}

export default config;

