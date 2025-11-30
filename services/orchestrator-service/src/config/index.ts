/**
 * Centralized configuration loader for orchestrator-service
 * Validates required environment variables and exports typed config
 * Supports AWS Secrets Manager (stubbed for MVP)
 */

import { getSecret, getSecrets } from './secrets';

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
  secrets: {
    useAwsSecrets: boolean;
    awsRegion?: string;
    secretName?: string;
  };
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

async function loadConfigAsync(): Promise<OrchestratorConfig> {
  const useAwsSecrets = getEnvVarAsBoolean('USE_AWS_SECRETS', false);
  const secretsConfig = {
    useAwsSecrets,
    awsRegion: process.env.AWS_REGION,
    secretName: process.env.SECRET_NAME
  };

  // Load secrets (from AWS or env vars)
  let githubToken = '';
  let dbPassword = '';
  let dbUser = '';
  let dbHost = '';
  let dbName = '';

  if (useAwsSecrets) {
    try {
      // In production, this would load from AWS Secrets Manager
      const secrets = await getSecrets(
        ['GITHUB_TOKEN', 'DB_PASSWORD', 'DB_USER', 'DB_HOST', 'DB_NAME'],
        secretsConfig
      );
      githubToken = secrets.GITHUB_TOKEN || '';
      dbPassword = secrets.DB_PASSWORD || '';
      dbUser = secrets.DB_USER || '';
      dbHost = secrets.DB_HOST || '';
      dbName = secrets.DB_NAME || '';
    } catch (error: any) {
      console.error('❌ Failed to load secrets from AWS Secrets Manager:', error.message);
      console.error('   Set USE_AWS_SECRETS=false to use environment variables instead');
      process.exit(1);
    }
  } else {
    // Use environment variables
    githubToken = getEnvVar('GITHUB_TOKEN', '');
    dbPassword = getEnvVar('DB_PASSWORD', 'reviewerpass');
    dbUser = getEnvVar('DB_USER', 'reviewer');
    dbHost = getEnvVar('DB_HOST', 'localhost');
    dbName = getEnvVar('DB_NAME', 'code_reviewer');
  }

  return {
    port: getEnvVarAsNumber('PORT', 5000),
    corsOrigin: getEnvVar('CORS_ORIGIN', 'http://localhost:3000'),
    kafkaBroker: getEnvVar('KAFKA_BROKER', 'localhost:9092'),
    kafkaGroupId: getEnvVar('KAFKA_GROUP_ID', 'orchestrator-service'),
    aiServiceUrl: getEnvVar('AI_SERVICE_URL', 'http://localhost:8001'),
    useMockAI: getEnvVarAsBoolean('USE_MOCK_AI', false),
    githubToken,
    database: {
      host: dbHost || getEnvVar('DB_HOST', 'localhost'),
      port: getEnvVarAsNumber('DB_PORT', 3308),
      user: dbUser || getEnvVar('DB_USER', 'reviewer'),
      password: dbPassword || getEnvVar('DB_PASSWORD', 'reviewerpass'),
      database: dbName || getEnvVar('DB_NAME', 'code_reviewer')
    },
    secrets: secretsConfig
  };
}

// Validate and export config (async for AWS Secrets Manager support)
// Note: For MVP, we use a synchronous wrapper that loads config on import
// In production, services should await loadConfig() during startup

let configCache: OrchestratorConfig | null = null;

async function initializeConfig(): Promise<OrchestratorConfig> {
  if (!configCache) {
    configCache = await loadConfigAsync();
    
    // Warn if GITHUB_TOKEN is not set (needed for posting comments)
    if (!configCache.githubToken) {
      console.warn('⚠️  GITHUB_TOKEN is not set. GitHub comment posting will be skipped.');
    }
  }
  return configCache;
}

// For backward compatibility, export a synchronous config loader
// This will use env vars only (USE_AWS_SECRETS=false by default)
export function loadConfigSync(): OrchestratorConfig {
  const useAwsSecrets = getEnvVarAsBoolean('USE_AWS_SECRETS', false);
  
  if (useAwsSecrets) {
    console.error('❌ USE_AWS_SECRETS=true requires async config loading');
    console.error('   Use await loadConfig() instead of loadConfigSync()');
    process.exit(1);
  }

  return {
    port: getEnvVarAsNumber('PORT', 5000),
    corsOrigin: getEnvVar('CORS_ORIGIN', 'http://localhost:3000'),
    kafkaBroker: getEnvVar('KAFKA_BROKER', 'localhost:9092'),
    kafkaGroupId: getEnvVar('KAFKA_GROUP_ID', 'orchestrator-service'),
    aiServiceUrl: getEnvVar('AI_SERVICE_URL', 'http://localhost:8001'),
    useMockAI: getEnvVarAsBoolean('USE_MOCK_AI', false),
    githubToken: getEnvVar('GITHUB_TOKEN', ''),
    database: {
      host: getEnvVar('DB_HOST', 'localhost'),
      port: getEnvVarAsNumber('DB_PORT', 3308),
      user: getEnvVar('DB_USER', 'reviewer'),
      password: getEnvVar('DB_PASSWORD', 'reviewerpass'),
      database: getEnvVar('DB_NAME', 'code_reviewer')
    },
    secrets: {
      useAwsSecrets: false
    }
  };
}

// Default export uses sync loader for backward compatibility
const config = loadConfigSync();

if (!config.githubToken) {
  console.warn('⚠️  GITHUB_TOKEN is not set. GitHub comment posting will be skipped.');
}

export default config;
export { initializeConfig };
export async function loadConfig(): Promise<OrchestratorConfig> {
  return loadConfigAsync();
}

