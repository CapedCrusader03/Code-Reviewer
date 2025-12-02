/**
 * Secrets loader utility for webhook-service
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
    const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
    const client = new SSMClient({ region });
    const command = new GetParameterCommand({ Name: parameterName });
    const response = await client.send(command);
    return response.Parameter?.Value;
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.warn(`⚠️  @aws-sdk/client-ssm not installed. Install with: npm install @aws-sdk/client-ssm`);
    } else {
      console.warn(`⚠️  Failed to fetch parameter '${parameterName}' from Parameter Store: ${error.message}`);
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
export async function getSecret(key: string, config: SecretsConfig): Promise<string | undefined> {
  if (!config.useAwsSecrets) {
    return process.env[key];
  }

  if (!config.awsRegion) {
    console.warn(`⚠️  AWS_REGION not set, falling back to environment variable for ${key}`);
    return process.env[key];
  }

  // Use Parameter Store by default (FREE), fallback to Secrets Manager if specified
  const useParameterStore = config.useParameterStore !== false; // Default to true

  if (useParameterStore) {
    // Map environment variable names to Parameter Store paths
    const parameterMap: Record<string, string> = {
      'GITHUB_TOKEN': '/code-reviewer/github-token',
      'GITHUB_WEBHOOK_SECRET': '/code-reviewer/webhook-secret',
    };

    const parameterName = parameterMap[key] || `/code-reviewer/${key.toLowerCase().replace(/_/g, '-')}`;
    const value = await fetchFromParameterStore(parameterName, config.awsRegion);
    
    if (value) {
      return value;
    }
    
    // Fallback to environment variable
    console.warn(`⚠️  Parameter '${parameterName}' not found, falling back to environment variable`);
    return process.env[key];
  } else {
    // Use Secrets Manager (for backward compatibility)
    if (!config.secretName) {
      console.warn(`⚠️  SECRET_NAME not set, falling back to environment variable for ${key}`);
      return process.env[key];
    }

    const value = await fetchFromSecretsManager(key, config.secretName, config.awsRegion);
    return value || process.env[key];
  }
}
