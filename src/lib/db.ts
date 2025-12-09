/**
 * Prisma database client initialization
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from './logger.js';

const logger = createLogger({ module: 'db' });

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton Prisma client
 */
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Initialize database connection
 */
export async function initDB(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (error) {
    logger.error({ error }, 'Database connection failed');
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDB(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

/**
 * Health check for database
 */
export async function checkDBHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
