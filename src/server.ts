/**
 * Main Fastify server initialization and startup
 */

import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import { v4 as uuidv4 } from 'uuid';
import { httpLogger, logger, createLogger } from './lib/logger.js';
import { initCache, closeCache } from './lib/cache.js';
import { initDB, closeDB } from './lib/db.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerExplainRoute } from './routes/explain.js';
import { registerMetricsRoute } from './routes/metrics.js';

const serverLogger = createLogger({ module: 'server' });

/**
 * Create and configure Fastify app
 */
export async function createApp() {
  const app = Fastify({
    logger: httpLogger as any,
    requestIdLogLabel: 'req_id',
    disableRequestLogging: false,
    requestTimeout: 30000,
  });

  // Assign unique request IDs
  app.addHook('onRequest', async (request) => {
    request.id = uuidv4();
  });

  // Security headers
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });

  // CORS
  await app.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN || ['http://localhost:3001', 'http://localhost:5173'],
    credentials: true,
  });

  // Health check
  await registerHealthRoutes(app);

  // API routes
  await registerExplainRoute(app);
  await registerMetricsRoute(app);

  // Root endpoint
  app.get('/', async () => ({
    name: 'SQL Playground API',
    version: '0.1.0',
    docs: 'https://github.com/sql-playground/sql-playground-api',
  }));

  // 404 handler
  app.setNotFoundHandler(async (_request, reply) => {
    return reply.code(404).send({
      success: false,
      error: 'Not found',
    });
  });

  // Error handler
  app.setErrorHandler(async (error, _request, reply) => {
    serverLogger.error({ error }, 'Unhandled error');
    return reply.code(error.statusCode || 500).send({
      success: false,
      error: error.message || 'Internal server error',
    });
  });

  return app;
}

/**
 * Start server
 */
export async function start() {
  try {
    // Initialize services
    await initDB();
    await initCache();

    // Create and start app
    const app = await createApp();
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    serverLogger.info(`Server listening on http://${host}:${port}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        serverLogger.info(`Received ${signal}, shutting down gracefully...`);
        await app.close();
        await closeCache();
        await closeDB();
        process.exit(0);
      });
    }
  } catch (err) {
    serverLogger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
