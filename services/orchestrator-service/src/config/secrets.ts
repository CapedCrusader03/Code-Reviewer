/**
 * Secrets loader utility for orchestrator-service
 * Supports AWS SSM Parameter Store (recommended, FREE) and AWS Secrets Manager
 */

interface SecretsConfig {
  useAwsSecrets: boolean;
  awsRegion?: string;
  secretName?: string;
  useParameterStore?: boolean; // New: Use Parameter Store instead of Secrets Manager
}

// Fetch from AWS SSM Parameter Store (FREE for standard parameters)
async function fetchFromParameterStore(parameterName: string, region: string): Promise<string | undefined> {
  try {
    // Try to use AWS SDK if available
    const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
    const client = new SSMClient({ region });
    const command = new GetParameterCommand({ Name: parameterName });
    const response = await client.send(command);
    return response.Parameter?.Value;
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.warn(`⚠️  @aws-sdk/client-ssm not installed. Install with: npm install @aws-sdk/client-ssm`);
      console.warn(`   Falling back to environment variables.`);
    } else {
      console.warn(`⚠️  Failed to fetch parameter '${parameterName}' from Parameter Store: ${error.message}`);
      console.warn(`   Falling back to environment variables.`);
    }
    return undefined;
  }
}

// Fetch from AWS Secrets Manager (for backward compatibility)
async function fetchFromSecretsManager(key: string, secretName: string, region: string): Promise<string | undefined> {
  try {
    const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
    const client = new SecretsManagerClient({ region });
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);
    if (response.SecretString) {
      const secrets = JSON.parse(response.SecretString);
      return secrets[key];
    }
    return undefined;
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.warn(`⚠️  @aws-sdk/client-secrets-manager not installed.`);
    } else {
      console.warn(`⚠️  Failed to fetch secret '${key}' from Secrets Manager: ${error.message}`);
    }
    return undefined;
  }
}

/**
 * Load a secret value
 * - If USE_AWS_SECRETS=false: reads from environment variable
 * - If USE_AWS_SECRETS=true: reads from Parameter Store (default) or Secrets Manager
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

  if (!config.awsRegion) {
    throw new Error('USE_AWS_SECRETS=true requires AWS_REGION to be set');
  }

  // Use Parameter Store by default (FREE), fallback to Secrets Manager if specified
  const useParameterStore = config.useParameterStore !== false; // Default to true

  if (useParameterStore) {
    // Map environment variable names to Parameter Store paths
    const parameterMap: Record<string, string> = {
      'GITHUB_TOKEN': '/code-reviewer/github-token',
      'DB_PASSWORD': '/code-reviewer/db-password',
      'DB_USER': '/code-reviewer/db-user',
      'DB_HOST': '/code-reviewer/db-host',
      'DB_NAME': '/code-reviewer/db-name',
    };

    const parameterName = parameterMap[secretKey] || `/code-reviewer/${secretKey.toLowerCase().replace(/_/g, '-')}`;
    const value = await fetchFromParameterStore(parameterName, config.awsRegion);
    
    if (value) {
      return value;
    }
    
    // Fallback to environment variable if Parameter Store fails
    console.warn(`⚠️  Parameter '${parameterName}' not found in Parameter Store, falling back to environment variable`);
    const envValue = process.env[secretKey];
    if (!envValue) {
      throw new Error(`Secret ${secretKey} not found in Parameter Store or environment variables`);
    }
    return envValue;
  } else {
    // Use Secrets Manager (for backward compatibility)
    if (!config.secretName) {
      throw new Error('USE_AWS_SECRETS=true with Secrets Manager requires SECRET_NAME to be set');
    }

    const value = await fetchFromSecretsManager(secretKey, config.secretName, config.awsRegion);
    
    if (value) {
      return value;
    }
    
    // Fallback to environment variable
    console.warn(`⚠️  Secret '${secretKey}' not found in Secrets Manager, falling back to environment variable`);
    const envValue = process.env[secretKey];
    if (!envValue) {
      throw new Error(`Secret ${secretKey} not found in Secrets Manager or environment variables`);
    }
    return envValue;
  }
}

/**
 * Load multiple secrets at once
 */
export async function getSecrets(
  secretKeys: string[],
  config: SecretsConfig
): Promise<Record<string, string>> {
  const secrets: Record<string, string> = {};
  
  for (const key of secretKeys) {
    secrets[key] = await getSecret(key, config);
  }
  
  return secrets;
}
