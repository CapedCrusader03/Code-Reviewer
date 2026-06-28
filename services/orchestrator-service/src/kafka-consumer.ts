import { Kafka, Consumer, Producer, EachMessagePayload } from 'kafkajs';
import db from './db';
import { callAIService } from './ai-service';
import { postGitHubReview } from './github-service';
import config from './config';
import { reviewsTotal } from './metrics';

const KAFKA_BROKER = config.kafkaBroker;
const KAFKA_GROUP_ID = config.kafkaGroupId;

const kafka = new Kafka({
  clientId: 'orchestrator-service',
  brokers: [KAFKA_BROKER],
});

// Consumer for incoming webhook events
const webhookConsumer: Consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });

// Consumer for receiving static analysis results from the worker
const resultsConsumer: Consumer = kafka.consumer({ groupId: `${KAFKA_GROUP_ID}-static-results` });

// Producer for dispatching work to the static analysis worker
const producer: Producer = kafka.producer();

interface CodeReviewMessage {
  job_id: string;
  repo: string;
  pr_number: number;
  commit_sha: string;
  diff: string;
}

interface StaticAnalysisResult {
  job_id: string;
  static_metrics: any;
  code_context: Record<string, string>;
  error?: string;
}

// ─── Consumer 1: Webhook Events ───────────────────────────────────────────────
// Registers a pending review in the database and dispatches the static analysis job.

async function handleWebhookMessage({ message }: EachMessagePayload): Promise<void> {
  const raw = message.value?.toString();
  if (!raw) return;

  let data: CodeReviewMessage;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error('[orchestrator] Failed to parse webhook message:', err);
    return;
  }

  const { job_id, repo, pr_number, commit_sha, diff } = data;
  console.log(`[orchestrator] Received PR review request: job=${job_id}, ${repo}#${pr_number}`);

  try {
    // 1. Write initial pending record to the database
    await db('reviews').insert({
      job_id,
      repo,
      pr_number,
      commit_sha,
      status: 'pending',
      // Temporarily store the raw diff in static_metrics JSON for retrieval later
      static_metrics: JSON.stringify({ _diff: diff }),
      created_at: db.fn.now(),
    });

    console.log(`[orchestrator] Created review record for job ${job_id}`);

    // 2. Dispatch work to the static analysis worker
    await producer.send({
      topic: 'static-analysis-requests',
      messages: [{
        key: job_id,
        value: JSON.stringify({ job_id, repo, pr_number, commit_sha }),
      }],
    });

    console.log(`[orchestrator] Dispatched job ${job_id} to static-analysis-requests`);
  } catch (error: any) {
    console.error(`[orchestrator] Failed to handle webhook message for job ${job_id}:`, error.message);
  }
}

// ─── Consumer 2: Static Analysis Results ──────────────────────────────────────
// Receives linter metrics + code context, calls the AI service, posts inline
// GitHub comments, and marks the review as done.

async function handleStaticAnalysisResult({ message }: EachMessagePayload): Promise<void> {
  const raw = message.value?.toString();
  if (!raw) return;

  let data: StaticAnalysisResult;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error('[orchestrator] Failed to parse static analysis result:', err);
    return;
  }

  const { job_id, static_metrics, code_context, error: workerError } = data;
  console.log(`[orchestrator] Received static analysis results for job ${job_id}`);

  try {
    // Retrieve the review record and the cached diff text
    const review = await db('reviews').where({ job_id }).first();
    if (!review) {
      console.error(`[orchestrator] No review record found for job ${job_id}`);
      return;
    }

    // If the static worker reported an error, mark the review as failed
    if (workerError) {
      console.error(`[orchestrator] Static worker reported an error for job ${job_id}: ${workerError}`);
      await db('reviews').where({ job_id }).update({ status: 'failed' });
      reviewsTotal.inc({ status: 'failed' });
      return;
    }

    // Recover the diff that was cached when the webhook arrived
    const cachedMetrics = JSON.parse(review.static_metrics || '{}');
    const diff: string = cachedMetrics._diff || '';

    // Mark review as running
    await db('reviews').where({ job_id }).update({ status: 'running' });

    // 3. Call the AI Service with diff, linter metrics, and codebase context
    console.log(`[orchestrator] Calling AI service for job ${job_id}...`);
    const aiResponse = await callAIService(diff, static_metrics, code_context);

    // 4. Persist findings to the database
    if (aiResponse.findings && aiResponse.findings.length > 0) {
      const validTypes = ['code_smell', 'security_issue', 'suggestion', 'best_practice'];
      const validSeverities = ['low', 'medium', 'high', 'critical'];

      const normalizeType = (t: string) => validTypes.includes(t.toLowerCase()) ? t.toLowerCase() : 'suggestion';
      const normalizeSeverity = (s: string) => validSeverities.includes(s.toLowerCase()) ? s.toLowerCase() : 'low';

      const findingsToInsert = aiResponse.findings.map((f: any) => ({
        review_id: review.id,
        type: normalizeType(f.type),
        severity: normalizeSeverity(f.severity),
        file_path: f.file_path || null,
        line_number: f.line_number || null,
        message: f.message,
        suggestion: f.suggestion || null,
        created_at: db.fn.now(),
      }));

      await db('findings').insert(findingsToInsert);
      console.log(`[orchestrator] Inserted ${findingsToInsert.length} findings for job ${job_id}`);
    }

    // 5. Post inline PR review comments to GitHub
    const commentId = await postGitHubReview(
      review.repo,
      review.pr_number,
      review.commit_sha,
      aiResponse.findings || []
    );

    if (commentId) {
      console.log(`[orchestrator] Posted GitHub review ${commentId} for job ${job_id}`);
    }

    // 6. Mark review as done
    await db('reviews').where({ id: review.id }).update({
      quality_score: aiResponse.quality_score,
      github_comment_id: commentId,
      static_metrics: JSON.stringify(static_metrics),
      status: 'done',
      completed_at: db.fn.now(),
    });

    reviewsTotal.inc({ status: 'done' });
    console.log(`[orchestrator] Job ${job_id} completed with quality score ${aiResponse.quality_score}`);

  } catch (error: any) {
    console.error(`[orchestrator] Failed to process static analysis result for job ${job_id}:`, error.message);
    await db('reviews').where({ job_id }).update({ status: 'failed' }).catch(() => {});
    reviewsTotal.inc({ status: 'failed' });
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function startKafkaConsumer(): Promise<void> {
  await producer.connect();
  console.log('[orchestrator] Kafka producer connected');

  await webhookConsumer.connect();
  await webhookConsumer.subscribe({ topic: 'code-review-requests', fromBeginning: false });
  await webhookConsumer.run({ eachMessage: handleWebhookMessage });
  console.log('[orchestrator] Subscribed to code-review-requests');
}

export async function startStaticAnalysisConsumer(): Promise<void> {
  await resultsConsumer.connect();
  await resultsConsumer.subscribe({ topic: 'static-analysis-results', fromBeginning: false });
  await resultsConsumer.run({ eachMessage: handleStaticAnalysisResult });
  console.log('[orchestrator] Subscribed to static-analysis-results');
}

export async function stopKafkaConsumer(): Promise<void> {
  await webhookConsumer.disconnect();
  await resultsConsumer.disconnect();
  await producer.disconnect();
  console.log('[orchestrator] All Kafka connections disconnected');
}
