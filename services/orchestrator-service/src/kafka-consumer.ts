import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import db from './db';

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || 'orchestrator-service';

const kafka = new Kafka({
  clientId: 'orchestrator-service',
  brokers: [KAFKA_BROKER]
});

const consumer: Consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });

interface CodeReviewMessage {
  job_id: string;
  repo: string;
  pr_number: number;
  commit_sha: string;
  diff: string;
}

async function processMessage(message: CodeReviewMessage): Promise<void> {
  const { job_id, repo, pr_number, commit_sha, diff } = message;

  console.log(`Processing job: ${job_id} for ${repo}#${pr_number}`);

  try {
    // Create review record with status='running'
    const [review_id] = await db('reviews').insert({
      job_id,
      repo,
      pr_number,
      commit_sha,
      status: 'running',
      created_at: db.fn.now()
    });

    console.log(`Created review ${review_id} with status=running for job ${job_id}`);
  } catch (error: any) {
    console.error(`Error processing message for job ${job_id}:`, error.message);
    throw error;
  }
}

async function handleMessage({ topic, partition, message }: EachMessagePayload): Promise<void> {
  const value = message.value?.toString();
  
  if (!value) {
    console.error('Received empty message');
    return;
  }

  try {
    const reviewRequest: CodeReviewMessage = JSON.parse(value);
    await processMessage(reviewRequest);
  } catch (error: any) {
    console.error('Error handling Kafka message:', error.message);
  }
}

export async function startKafkaConsumer(): Promise<void> {
  try {
    await consumer.connect();
    console.log('Kafka consumer connected');

    await consumer.subscribe({ topic: 'code-review-requests', fromBeginning: false });
    console.log('Subscribed to topic: code-review-requests');

    await consumer.run({
      eachMessage: handleMessage
    });

    console.log('Kafka consumer started');
  } catch (error) {
    console.error('Failed to start Kafka consumer:', error);
    throw error;
  }
}

export async function stopKafkaConsumer(): Promise<void> {
  await consumer.disconnect();
  console.log('Kafka consumer disconnected');
}

