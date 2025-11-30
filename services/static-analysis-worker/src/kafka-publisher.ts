import { Kafka, Producer } from 'kafkajs';
import config from './config';

const KAFKA_BROKER = config.kafkaBroker;

const kafka = new Kafka({
  clientId: 'static-analysis-worker',
  brokers: [KAFKA_BROKER]
});

const producer: Producer = kafka.producer();

let producerReady = false;

/**
 * Connect Kafka producer
 */
export async function connectProducer(): Promise<void> {
  try {
    console.log(`Attempting to connect to Kafka at ${KAFKA_BROKER}...`);
    await producer.connect();
    producerReady = true;
    console.log('Kafka producer connected');
  } catch (error: any) {
    console.error('Failed to connect Kafka producer:', error.message);
    console.error(`\nTroubleshooting:`);
    console.error(`  1. Ensure Kafka is running: docker ps | grep kafka`);
    console.error(`  2. Check Kafka logs: docker logs kafka`);
    console.error(`  3. Verify KAFKA_BROKER env var (current: ${KAFKA_BROKER})`);
    console.error(`  4. Start infrastructure: cd infrastructure && docker-compose up -d kafka zookeeper`);
    throw error;
  }
}

/**
 * Disconnect Kafka producer
 */
export async function disconnectProducer(): Promise<void> {
  try {
    await producer.disconnect();
    producerReady = false;
    console.log('Kafka producer disconnected');
  } catch (error: any) {
    console.error('Failed to disconnect Kafka producer:', error.message);
  }
}

/**
 * Publish static analysis results to Kafka
 */
export async function publishStaticAnalysisResults(
  jobId: string,
  staticMetrics: any
): Promise<void> {
  if (!producerReady) {
    throw new Error('Kafka producer not connected. Call connectProducer() first.');
  }

  const message = {
    job_id: jobId,
    static_metrics: staticMetrics
  };

  try {
    await producer.send({
      topic: 'static-analysis-results',
      messages: [
        {
          key: jobId,
          value: JSON.stringify(message)
        }
      ]
    });

    console.log(`Published static analysis results for job ${jobId} to Kafka`);
  } catch (error: any) {
    console.error(`Failed to publish static analysis results for job ${jobId}:`, error.message);
    throw error;
  }
}

