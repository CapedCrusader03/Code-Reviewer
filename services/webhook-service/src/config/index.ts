/**
 * Centralized configuration loader for webhook-service
 * Validates required environment variables and exports typed config
 * Supports AWS Secrets Manager (stubbed for MVP)
 */

interface WebhookConfig {
  port: number;
  webhookSecret: string;
  githubToken: string;
  kafkaBroker: string;
  secrets: {
    useAwsSecrets: boolean;
    awsRegion?: string;
    secretName?: string;
    useParameterStore?: boolean;
  };
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && defaultValue === undefined) {
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

export async function loadConfigAsync(): Promise<WebhookConfig> {
  const useAwsSecrets = getEnvVarAsBoolean('USE_AWS_SECRETS', false);
  const useParameterStore = getEnvVarAsBoolean('USE_PARAMETER_STORE', true); // Default to Parameter Store
  const secretsConfig = {
    useAwsSecrets,
    awsRegion: process.env.AWS_REGION,
    secretName: process.env.SECRET_NAME,
    useParameterStore
  };

  let webhookSecret = '';
  let githubToken = '';

  if (useAwsSecrets) {
    try {
      const { getSecret } = await import('./secrets');
      webhookSecret = (await getSecret('GITHUB_WEBHOOK_SECRET', secretsConfig)) || getEnvVar('GITHUB_WEBHOOK_SECRET', 'default-secret');
      githubToken = (await getSecret('GITHUB_TOKEN', secretsConfig)) || process.env.GITHUB_TOKEN || process.env.GITHUB_ACCESS_TOKEN || '';
    } catch (error: any) {
      console.warn('⚠️  Failed to load secrets from AWS, falling back to environment variables:', error.message);
      webhookSecret = getEnvVar('GITHUB_WEBHOOK_SECRET', 'default-secret');
      githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_ACCESS_TOKEN || '';
    }
  } else {
    webhookSecret = getEnvVar('GITHUB_WEBHOOK_SECRET', 'default-secret');
    githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_ACCESS_TOKEN || '';
  }

  return {
    port: getEnvVarAsNumber('PORT', 4000),
    webhookSecret,
    githubToken,
    kafkaBroker: getEnvVar('KAFKA_BROKER', 'localhost:9092'),
    secrets: secretsConfig
  };
}

// Synchronous version for backward compatibility
export function loadConfig(): WebhookConfig {
  const useAwsSecrets = getEnvVarAsBoolean('USE_AWS_SECRETS', false);
  
  // For synchronous loading, we can't use async Parameter Store
  // So we'll use environment variables and warn if AWS secrets are requested
  if (useAwsSecrets) {
    console.warn('⚠️  USE_AWS_SECRETS=true requires async config loading');
    console.warn('   Use loadConfigAsync() for Parameter Store support, or set USE_AWS_SECRETS=false');
  }

  return {
    port: getEnvVarAsNumber('PORT', 4000),
    webhookSecret: getEnvVar('GITHUB_WEBHOOK_SECRET', 'default-secret'),
    githubToken: process.env.GITHUB_TOKEN || process.env.GITHUB_ACCESS_TOKEN || '',
    kafkaBroker: getEnvVar('KAFKA_BROKER', 'localhost:9092'),
    secrets: {
      useAwsSecrets,
      awsRegion: process.env.AWS_REGION,
      secretName: process.env.SECRET_NAME,
      useParameterStore: getEnvVarAsBoolean('USE_PARAMETER_STORE', true)
    }
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

