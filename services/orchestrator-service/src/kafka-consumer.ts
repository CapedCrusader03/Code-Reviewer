import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import db from './db';
import { callAIService } from './ai-service';
import { postGitHubComment } from './github-service';
import config from './config';
import { reviewsTotal } from './metrics';

const KAFKA_BROKER = config.kafkaBroker;
const KAFKA_GROUP_ID = config.kafkaGroupId;

const kafka = new Kafka({
  clientId: 'orchestrator-service',
  brokers: [KAFKA_BROKER]
});

const consumer: Consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });
const staticAnalysisConsumer: Consumer = kafka.consumer({ groupId: `${KAFKA_GROUP_ID}-static-analysis` });

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

    // Call AI service for review
    console.log(`Calling AI service for review ${review_id}`);
    const aiResponse = await callAIService(diff);

    // Persist findings
    if (aiResponse.findings && aiResponse.findings.length > 0) {
      // Valid enum values for type and severity
      const validTypes = ['code_smell', 'security_issue', 'suggestion', 'best_practice'];
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      
      // Normalize finding types and severities to match database enum
      const normalizeType = (type: string): string => {
        const lowerType = type.toLowerCase();
        // Map common variations to valid types
        if (lowerType.includes('error') || lowerType.includes('issue') || lowerType.includes('bug')) {
          return 'code_smell';
        }
        if (lowerType.includes('security') || lowerType.includes('vulnerability')) {
          return 'security_issue';
        }
        if (lowerType.includes('best') || lowerType.includes('practice') || lowerType.includes('pattern')) {
          return 'best_practice';
        }
        // Default to suggestion if not recognized
        return validTypes.includes(lowerType) ? lowerType : 'suggestion';
      };
      
      const normalizeSeverity = (severity: string): string => {
        const lowerSeverity = severity.toLowerCase();
        return validSeverities.includes(lowerSeverity) ? lowerSeverity : 'low';
      };
      
      const findingsToInsert = aiResponse.findings.map(finding => ({
        review_id,
        type: normalizeType(finding.type),
        severity: normalizeSeverity(finding.severity),
        file_path: finding.file_path || null,
        line_number: finding.line_number || null,
        message: finding.message,
        suggestion: finding.suggestion || null,
        created_at: db.fn.now()
      }));

      await db('findings').insert(findingsToInsert);
      console.log(`Inserted ${findingsToInsert.length} findings for review ${review_id}`);
    }

    // Update review with quality score
    await db('reviews')
      .where({ id: review_id })
      .update({
        quality_score: aiResponse.quality_score
      });

    console.log(`Completed review ${review_id} with quality score ${aiResponse.quality_score}`);

    // Post comment to GitHub with top 3 suggestions
    const commentId = await postGitHubComment({
      review_id,
      repo,
      pr_number,
      quality_score: aiResponse.quality_score,
      findings: aiResponse.findings
    });

    if (commentId) {
      console.log(`Posted GitHub comment ${commentId} for review ${review_id}`);
    } else {
      console.log(`Skipped GitHub comment for review ${review_id} (no token or error)`);
    }

    // Mark review as done and set completed_at timestamp
    await db('reviews')
      .where({ id: review_id })
      .update({
        status: 'done',
        completed_at: db.fn.now()
      });

    // Increment reviews_total metric
    reviewsTotal.inc({ status: 'done' });

    console.log(`Marked review ${review_id} as done with completed_at timestamp`);
  } catch (error: any) {
    console.error(`Error processing message for job ${job_id}:`, error.message);
    
    // Try to mark the review as failed in DB if it was created
    try {
      await db('reviews')
        .where({ job_id })
        .update({ status: 'failed' });
      
      // Increment reviews_total metric for failed reviews
      reviewsTotal.inc({ status: 'failed' });
    } catch (dbError) {
      console.error('Failed to update review status to failed:', dbError);
    }
    
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
  await staticAnalysisConsumer.disconnect();
  console.log('Kafka consumers disconnected');
}

interface StaticAnalysisMessage {
  job_id: string;
  static_metrics: any;
}

async function processStaticAnalysisMessage(message: StaticAnalysisMessage): Promise<void> {
  const { job_id, static_metrics } = message;

  console.log(`Processing static analysis results for job: ${job_id}`);

  try {
    // Update reviews table with static_metrics for the corresponding job_id
    const updated = await db('reviews')
      .where({ job_id })
      .update({
        static_metrics: JSON.stringify(static_metrics)
      });

    if (updated === 0) {
      console.warn(`No review found with job_id: ${job_id}`);
    } else {
      console.log(`Updated static_metrics for job ${job_id}`);
    }
  } catch (error: any) {
    console.error(`Error processing static analysis results for job ${job_id}:`, error.message);
    throw error;
  }
}

async function handleStaticAnalysisMessage({ topic, partition, message }: EachMessagePayload): Promise<void> {
  const value = message.value?.toString();
  
  console.log(`Received message on topic: ${topic}, partition: ${partition}, offset: ${message.offset}`);
  
  if (!value) {
    console.error('Received empty static analysis message');
    return;
  }

  try {
    console.log(`Parsing static analysis message: ${value.substring(0, 100)}...`);
    const staticAnalysisResult: StaticAnalysisMessage = JSON.parse(value);
    console.log(`Parsed message - job_id: ${staticAnalysisResult.job_id}`);
    await processStaticAnalysisMessage(staticAnalysisResult);
  } catch (error: any) {
    console.error('Error handling static analysis message:', error.message);
    console.error('Error stack:', error.stack);
  }
}

export async function startStaticAnalysisConsumer(): Promise<void> {
  try {
    await staticAnalysisConsumer.connect();
    console.log('Static analysis Kafka consumer connected');

    await staticAnalysisConsumer.subscribe({ topic: 'static-analysis-results', fromBeginning: true });
    console.log('Subscribed to topic: static-analysis-results');

    await staticAnalysisConsumer.run({
      eachMessage: handleStaticAnalysisMessage
    });

    console.log('Static analysis Kafka consumer started');
  } catch (error) {
    console.error('Failed to start static analysis Kafka consumer:', error);
    throw error;
  }
}

