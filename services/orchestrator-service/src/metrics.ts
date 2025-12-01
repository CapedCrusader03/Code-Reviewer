/**
 * Prometheus metrics for orchestrator-service
 */

import { Registry, Counter, Histogram } from 'prom-client';

// Create a registry to register metrics
export const register = new Registry();

// Counter for total reviews processed
export const reviewsTotal = new Counter({
  name: 'reviews_total',
  help: 'Total number of code reviews processed',
  labelNames: ['status'], // status: done, failed, running
  registers: [register]
});

// Histogram for AI service latency
export const aiLatencyMs = new Histogram({
  name: 'ai_latency_ms',
  help: 'AI service call latency in milliseconds',
  buckets: [100, 500, 1000, 2000, 5000, 10000, 30000], // buckets in ms
  registers: [register]
});

// Register default metrics (CPU, memory, etc.)
register.setDefaultLabels({
  service: 'orchestrator-service'
});

