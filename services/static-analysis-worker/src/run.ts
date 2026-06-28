#!/usr/bin/env node

/**
 * Static Analysis Worker - Daemon Entrypoint
 *
 * Starts the Kafka consumer that listens for static-analysis-requests,
 * runs linting and dependency context extraction, and publishes results
 * back to the static-analysis-results topic.
 */

import { startWorker, stopWorker } from './kafka-consumer';

async function main() {
  console.log('[static-worker] Starting Static Analysis Worker daemon...');

  // Graceful shutdown on process signals
  process.on('SIGTERM', async () => {
    console.log('[static-worker] SIGTERM received, shutting down gracefully...');
    await stopWorker();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[static-worker] SIGINT received, shutting down gracefully...');
    await stopWorker();
    process.exit(0);
  });

  try {
    await startWorker();
  } catch (error: any) {
    console.error('[static-worker] Fatal error, exiting:', error.message);
    process.exit(1);
  }
}

main();

export {};
