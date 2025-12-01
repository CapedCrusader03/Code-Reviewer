/**
 * Sample test for static-analysis-worker config loader
 */

describe('Static Analysis Config Loader', () => {
  const originalEnv = process.env;
  const originalExit = process.exit;

  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    // Mock process.exit to prevent test suite from exiting
    process.exit = jest.fn() as any;
  });

  afterAll(() => {
    process.env = originalEnv;
    process.exit = originalExit;
  });

  it('should load config with default values', () => {
    delete process.env.KAFKA_BROKER;

    jest.resetModules();
    const { loadConfig } = require('../index');
    const config = loadConfig();

    expect(config.kafkaBroker).toBe('localhost:9092');
  });

  it('should load config from environment variables', () => {
    process.env.KAFKA_BROKER = 'kafka-cluster:9092';

    jest.resetModules();
    const { loadConfig } = require('../index');
    const config = loadConfig();

    expect(config.kafkaBroker).toBe('kafka-cluster:9092');
  });

  it('should include secrets config', () => {
    jest.resetModules();
    const { loadConfig } = require('../index');
    const config = loadConfig();
    
    expect(config.secrets).toBeDefined();
    expect(config.secrets.useAwsSecrets).toBe(false);
  });

  it('should handle USE_AWS_SECRETS flag', () => {
    process.env.USE_AWS_SECRETS = 'true';
    process.env.AWS_REGION = 'us-east-1';
    process.env.SECRET_NAME = 'test-secret';

    jest.resetModules();
    const { loadConfig } = require('../index');
    const config = loadConfig();

    expect(config.secrets.useAwsSecrets).toBe(true);
    expect(config.secrets.awsRegion).toBe('us-east-1');
    expect(config.secrets.secretName).toBe('test-secret');
  });
});

