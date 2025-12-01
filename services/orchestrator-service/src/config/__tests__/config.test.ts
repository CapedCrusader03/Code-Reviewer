/**
 * Sample test for orchestrator-service config loader
 */

describe('Orchestrator Config Loader', () => {
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
    delete process.env.CORS_ORIGIN;
    delete process.env.KAFKA_BROKER;
    delete process.env.KAFKA_GROUP_ID;
    delete process.env.AI_SERVICE_URL;
    delete process.env.USE_MOCK_AI;
    delete process.env.GITHUB_TOKEN;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;

    jest.resetModules();
    const { loadConfigSync } = require('../index');
    const config = loadConfigSync();

    expect(config.port).toBe(5000);
    expect(config.corsOrigin).toBe('http://localhost:3000');
    expect(config.kafkaBroker).toBe('localhost:9092');
    expect(config.kafkaGroupId).toBe('orchestrator-service');
    expect(config.aiServiceUrl).toBe('http://localhost:8001');
    expect(config.useMockAI).toBe(false);
    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(3308);
  });

  it('should load config from environment variables', () => {
    process.env.PORT = '6000';
    process.env.CORS_ORIGIN = 'http://localhost:4000';
    process.env.KAFKA_BROKER = 'kafka:9092';
    process.env.AI_SERVICE_URL = 'http://ai:8000';
    process.env.USE_MOCK_AI = 'true';
    process.env.DB_HOST = 'db.example.com';
    process.env.DB_PORT = '3306';

    jest.resetModules();
    const { loadConfigSync } = require('../index');
    const config = loadConfigSync();

    expect(config.port).toBe(6000);
    expect(config.corsOrigin).toBe('http://localhost:4000');
    expect(config.kafkaBroker).toBe('kafka:9092');
    expect(config.aiServiceUrl).toBe('http://ai:8000');
    expect(config.useMockAI).toBe(true);
    expect(config.database.host).toBe('db.example.com');
    expect(config.database.port).toBe(3306);
  });

  it('should parse boolean values correctly', () => {
    process.env.USE_MOCK_AI = 'true';
    jest.resetModules();
    const { loadConfigSync } = require('../index');
    expect(loadConfigSync().useMockAI).toBe(true);

    process.env.USE_MOCK_AI = 'false';
    jest.resetModules();
    const { loadConfigSync: loadConfigSync2 } = require('../index');
    expect(loadConfigSync2().useMockAI).toBe(false);
  });
});

