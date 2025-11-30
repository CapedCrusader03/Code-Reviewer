/**
 * Secrets loader utility for webhook-service
 * Supports reading secrets from AWS Secrets Manager or environment variables
 * 
 * For MVP: AWS Secrets Manager is stubbed but not fully implemented
 */

interface SecretsConfig {
  useAwsSecrets: boolean;
  awsRegion?: string;
  secretName?: string;
}

/**
 * Load a secret value
 * - If USE_AWS_SECRETS=false: reads from environment variable
 * - If USE_AWS_SECRETS=true: attempts to read from AWS Secrets Manager (stubbed for MVP)
 */
export async function getSecret(
  secretKey: string,
  config: SecretsConfig
): Promise<string> {
  if (!config.useAwsSecrets) {
    // Use environment variable
    const value = process.env[secretKey];
    if (!value) {
      throw new Error(`Secret ${secretKey} not found in environment variables`);
    }
    return value;
  }

  // AWS Secrets Manager path (stubbed for MVP)
  if (!config.secretName) {
    throw new Error('USE_AWS_SECRETS=true requires SECRET_NAME to be set');
  }

  if (!config.awsRegion) {
    throw new Error('USE_AWS_SECRETS=true requires AWS_REGION to be set');
  }

  // Stub: For MVP, we fail gracefully
  throw new Error(
    'AWS Secrets Manager integration is not fully implemented for MVP. ' +
    'Set USE_AWS_SECRETS=false to use environment variables instead.'
  );
}

