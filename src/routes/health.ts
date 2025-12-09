/**
 * /v1/health endpoint
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { checkDBHealth } from '../lib/db.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger({ module: 'health' });

/**
 * Health check response
 */
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    api: 'ok';
    database: 'ok' | 'error';
    cache: 'ok' | 'error';
  };
  uptime: number;
}

const startTime = Date.now();

/**
 * Register health check routes
 */
export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (
    _request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const dbHealth = await checkDBHealth();

    const status: HealthResponse['status'] = dbHealth ? 'healthy' : 'degraded';

    const response: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      services: {
        api: 'ok',
        database: dbHealth ? 'ok' : 'error',
        cache: 'ok', // TODO: check Redis
      },
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };

    const statusCode = dbHealth ? 200 : 503;
    return reply.code(statusCode).send(response);
  });

  logger.info('Health routes registered');
}
