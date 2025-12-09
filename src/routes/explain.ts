/**
 * /v1/explain endpoint
 * Main endpoint for SQL explanation
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ExplainRequestSchema } from '../types.js';
import { createLogger } from '../lib/logger.js';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { recordRequestMetrics, recordCacheHit, recordCacheMiss } from '../lib/metrics.js';
import { fingerprint, sanitizeSQL } from '@gabrudj/sql-engine';
import { explainSQLService } from '../services/engineService.js';

const logger = createLogger({ module: 'explain_route' });

/**
 * Register /v1/explain POST route
 */
export async function registerExplainRoute(app: FastifyInstance): Promise<void> {
  app.post<{ Body: unknown }>(
    '/v1/explain',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();
      const requestId = request.id;

      try {
        // Validate request body
        const parsed = ExplainRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            error: `Invalid request: ${parsed.error.message}`,
            requestId,
            timestamp: new Date().toISOString(),
          });
        }

        const req = parsed.data;
        const childLogger = createLogger({ requestId, sql: '**REDACTED**' });

        // Generate cache key from fingerprint
        const fp = fingerprint(req.sql);
        const cacheKey = `explain:${fp.hash}`;

        // Check cache if enabled
        let result;
        let fromCache = false;

        if (req.cache) {
          const cached = await cacheGet(cacheKey);
          if (cached) {
            recordCacheHit('explain');
            result = cached;
            fromCache = true;
            childLogger.debug('Cache hit');
          }
        }

        // If not cached, compute
        if (!result) {
          recordCacheMiss('explain');

          const sanitized = sanitizeSQL(req.sql, {
            enabled: req.privacyMode,
          });

          childLogger.debug({ privacy: req.privacyMode }, 'Computing explanation');

          result = await explainSQLService(
            req.sql,
            sanitized.sanitized,
            req.dialect,
            req.schema,
            req.explainPlan
          );

          // Cache the result
          if (req.cache) {
            await cacheSet(cacheKey, result, 3600);
          }
        }

        const duration = Date.now() - startTime;
        recordRequestMetrics('POST', '/v1/explain', 200, duration);

        return reply.code(200).send({
          success: true,
          data: {
            ...result,
            cached: fromCache,
            fingerprint: fp,
          },
          requestId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        recordRequestMetrics('POST', '/v1/explain', 500, duration);

        logger.error(
          { error, requestId },
          'Explain endpoint error'
        );

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          requestId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  logger.info('Explain route registered');
}
