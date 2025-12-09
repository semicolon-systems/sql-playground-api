/**
 * /v1/metrics endpoint
 * Prometheus metrics export
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getMetrics } from '../lib/metrics.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger({ module: 'metrics_route' });

/**
 * Register /v1/metrics GET route
 */
export async function registerMetricsRoute(app: FastifyInstance): Promise<void> {
  app.get('/v1/metrics', async (
    _request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const metrics = await getMetrics();
      return reply
        .header('Content-Type', 'text/plain; version=0.0.4')
        .send(metrics);
    } catch (error) {
      logger.error({ error }, 'Metrics export error');
      return reply.code(500).send('Failed to export metrics');
    }
  });

  logger.info('Metrics route registered');
}
