/**
 * Sample test for webhook-service config loader
 */

describe('Webhook Config Loader', () => {
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
    // Clear relevant env vars to test defaults
    delete process.env.PORT;
    delete process.env.GITHUB_WEBHOOK_SECRET;
    delete process.env.GITHUB_TOKEN;
    delete process.env.KAFKA_BROKER;

    // Import after setting env vars
    const { loadConfig } = require('../index');
    const config = loadConfig();

    expect(config.port).toBe(4000);
    expect(config.webhookSecret).toBe('default-secret');
    expect(config.githubToken).toBe('');
    expect(config.kafkaBroker).toBe('localhost:9092');
  });

  it('should load config from environment variables', () => {
    process.env.PORT = '5000';
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.KAFKA_BROKER = 'kafka:9092';

    jest.resetModules();
    const { loadConfig } = require('../index');
    const config = loadConfig();

    expect(config.port).toBe(5000);
    expect(config.webhookSecret).toBe('test-secret');
    expect(config.githubToken).toBe('test-token');
    expect(config.kafkaBroker).toBe('kafka:9092');
  });

  it('should parse PORT as a number', () => {
    process.env.PORT = '8080';
    jest.resetModules();
    const { loadConfig } = require('../index');
    const config = loadConfig();
    
    expect(config.port).toBe(8080);
    expect(typeof config.port).toBe('number');
  });
});

