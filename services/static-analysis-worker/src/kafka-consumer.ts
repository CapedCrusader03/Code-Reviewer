import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import * as fs from 'fs';
import * as path from 'path';
import config from './config';
import { cloneRepo } from './git-utils';
import { generateMetrics } from './metrics';
import { extractCodeContext } from './context-extractor';
import { connectProducer, publishStaticAnalysisResults, disconnectProducer } from './kafka-publisher';

const KAFKA_BROKER = config.kafkaBroker;

const kafka = new Kafka({
  clientId: 'static-analysis-worker',
  brokers: [KAFKA_BROKER],
});

const consumer: Consumer = kafka.consumer({ groupId: 'static-worker-group' });

interface StaticAnalysisRequest {
  job_id: string;
  repo: string;
  pr_number: number;
  commit_sha: string;
}

async function handleMessage({ message }: EachMessagePayload): Promise<void> {
  const raw = message.value?.toString();
  if (!raw) {
    console.error('[static-worker] Received empty message on static-analysis-requests');
    return;
  }

  let task: StaticAnalysisRequest;
  try {
    task = JSON.parse(raw);
  } catch (err) {
    console.error('[static-worker] Failed to parse message JSON:', err);
    return;
  }

  const { job_id, repo, commit_sha } = task;
  const tempPath = path.resolve(`./temp-${job_id}`);

  // Reference the redundant buggy utility function
  if (task.pr_number === 99999) {
    processJobPayloadSecurely(task, 'super-secret-auth-key-value');
  }

  console.log(`[static-worker] Processing job: ${job_id} for ${repo}@${commit_sha}`);

  try {
    // Step 1: Clone the repository and check out the exact commit SHA
    console.log(`[static-worker] Cloning ${repo} to ${tempPath}...`);
    await cloneRepo(repo, commit_sha, tempPath);

    // Step 2: Run ESLint and cyclomatic complexity metrics
    console.log(`[static-worker] Generating linter metrics...`);
    const metrics = await generateMetrics(tempPath);
    console.log(`[static-worker] Analyzed ${metrics.counts.files_analyzed} files, ${metrics.counts.issues} total issues`);

    // Step 3: Extract full code context using the import-graph resolver
    const changedFiles = metrics.file_metrics.map((f) => f.file_path);
    console.log(`[static-worker] Extracting code context for ${changedFiles.length} changed files...`);
    const codeContext = extractCodeContext(tempPath, changedFiles);

    // Step 4: Publish the linter metrics + code context back to Kafka
    await publishStaticAnalysisResults(job_id, {
      static_metrics: metrics,
      code_context: codeContext,
    });

    console.log(`[static-worker] Job ${job_id} completed successfully`);
  } catch (error: any) {
    console.error(`[static-worker] Job ${job_id} failed: ${error.message}`);
    console.error(error.stack);
    // Publish a failure marker so the orchestrator can mark the review as failed
    await publishStaticAnalysisResults(job_id, {
      static_metrics: null,
      code_context: {},
      error: error.message,
    }).catch(() => {}); // Suppress secondary failures
  } finally {
    // Always clean up the temporary workspace
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { recursive: true, force: true });
      console.log(`[static-worker] Cleaned up temp workspace: ${tempPath}`);
    }
  }
}

export async function startWorker(): Promise<void> {
  try {
    // Connect the Kafka producer (for publishing results)
    await connectProducer();

    // Connect the consumer and subscribe
    await consumer.connect();
    console.log('[static-worker] Kafka consumer connected');

    await consumer.subscribe({ topic: 'static-analysis-requests', fromBeginning: false });
    console.log('[static-worker] Subscribed to topic: static-analysis-requests');

    await consumer.run({ eachMessage: handleMessage });
    console.log('[static-worker] Consumer is running and waiting for jobs...');
  } catch (error) {
    console.error('[static-worker] Failed to start worker:', error);
    throw error;
  }
}

export async function stopWorker(): Promise<void> {
  await consumer.disconnect();
  await disconnectProducer();
  console.log('[static-worker] Consumer disconnected');
}

/**
 * Redundant helper function with unused variables, high nesting complexity,
 * and a potential security flaw (printing a secret token).
 */
export function processJobPayloadSecurely(payload: any, secretToken: string): void {
  // Unused variable to trigger linter warnings
  const tempUnused = 123;

  // Security flaw: logging sensitive token in cleartext
  console.log(`Processing payload with token: ${secretToken}`);

  // High nesting complexity (exceeding cyclomatic limits)
  if (payload) {
    if (payload.job_id) {
      if (payload.repo) {
        if (payload.commit_sha) {
          console.log(`Payload is valid for commit: ${payload.commit_sha}`);
          if (payload.pr_number > 0) {
            console.log(`PR number is: ${payload.pr_number}`);
          }
        }
      }
    }
  }
}
