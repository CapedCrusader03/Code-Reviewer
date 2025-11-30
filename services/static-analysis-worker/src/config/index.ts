/**
 * Centralized configuration loader for static-analysis-worker
 * Validates required environment variables and exports typed config
 * Supports AWS Secrets Manager (stubbed for MVP)
 */

interface StaticAnalysisConfig {
  kafkaBroker: string;
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

function getEnvVarAsBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

export function loadConfig(): StaticAnalysisConfig {
  const useAwsSecrets = getEnvVarAsBoolean('USE_AWS_SECRETS', false);
  
  // For MVP, we use env vars only (AWS Secrets Manager is stubbed)
  if (useAwsSecrets) {
    console.warn('⚠️  USE_AWS_SECRETS=true is set, but AWS Secrets Manager is not fully implemented for MVP');
    console.warn('   Falling back to environment variables. Set USE_AWS_SECRETS=false to suppress this warning.');
  }

  return {
    kafkaBroker: getEnvVar('KAFKA_BROKER', 'localhost:9092'),
    secrets: {
      useAwsSecrets,
      awsRegion: process.env.AWS_REGION,
      secretName: process.env.SECRET_NAME
    }
  };
}

// Validate and export config
const config = loadConfig();

export default config;

