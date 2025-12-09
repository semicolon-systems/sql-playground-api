/**
 * Prometheus metrics exporter
 */

import { register, Counter, Histogram, Gauge } from 'prom-client';

/**
 * Request counter by endpoint and status
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

/**
 * Request duration histogram
 */
export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

/**
 * Cache hits/misses counter
 */
export const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache_type'],
});

export const cacheMissesTotal = new Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['cache_type'],
});

/**
 * LLM API calls counter
 */
export const llmCallsTotal = new Counter({
  name: 'llm_calls_total',
  help: 'Total LLM API calls',
  labelNames: ['provider', 'status'],
});

/**
 * LLM token usage gauge
 */
export const llmTokensUsed = new Counter({
  name: 'llm_tokens_used_total',
  help: 'Total tokens used',
  labelNames: ['provider', 'type'], // type: prompt, completion
});

/**
 * Database query duration
 */
export const dbQueryDurationSeconds = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
});

/**
 * Active requests gauge
 */
export const activeRequests = new Gauge({
  name: 'active_requests',
  help: 'Number of active requests',
  labelNames: ['method', 'route'],
});

/**
 * Export metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Record request metrics
 */
export function recordRequestMetrics(
  method: string,
  route: string,
  statusCode: number,
  duration: number
): void {
  httpRequestsTotal.labels(method, route, String(statusCode)).inc();
  httpRequestDurationSeconds.labels(method, route, String(statusCode)).observe(duration / 1000);
}

/**
 * Record cache metrics
 */
export function recordCacheHit(cacheType: string): void {
  cacheHitsTotal.labels(cacheType).inc();
}

export function recordCacheMiss(cacheType: string): void {
  cacheMissesTotal.labels(cacheType).inc();
}
