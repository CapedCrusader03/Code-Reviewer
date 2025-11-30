/**
 * Centralized configuration loader for static-analysis-worker
 * Validates required environment variables and exports typed config
 */

interface StaticAnalysisConfig {
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

export function loadConfig(): StaticAnalysisConfig {
  return {
    kafkaBroker: getEnvVar('KAFKA_BROKER', 'localhost:9092')
  };
}

// Validate and export config
const config = loadConfig();

export default config;

