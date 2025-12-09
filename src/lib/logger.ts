/**
 * Pino logger configuration with structured logging
 */

import pino from 'pino';
import pinoHttp from 'pino-http';

const logLevel = process.env.LOG_LEVEL || 'info';

/**
 * Create main logger instance
 */
export const logger = pino({
  level: logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      singleLine: false,
    },
  },
  serializers: {
    // Don't log raw SQL in production
    sql: (sql: string) => `<REDACTED_SQL_${sql.length}_CHARS>`,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
});

/**
 * Create HTTP logger middleware for Fastify
 */
export const httpLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => {
      // Skip logging health checks
      return req.url?.includes('/health');
    },
  },
});

/**
 * Create child logger with context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
