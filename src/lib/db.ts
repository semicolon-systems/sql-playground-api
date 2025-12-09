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
    // Extract and log connection details (without password)
    const dbUrl = process.env.DATABASE_URL || '';
    const isSupabase = dbUrl.includes('supabase.co');
    const isLocal = dbUrl.includes('localhost');
    const provider = isSupabase ? 'Supabase' : isLocal ? 'Local PostgreSQL' : 'External PostgreSQL';

    logger.info(`Attempting database connection to ${provider}...`);
    await prisma.$connect();
    logger.info({ provider }, 'Database connected successfully');
  } catch (error) {
    logger.error({ error }, 'Database connection failed');
    logger.error(
      'Check that DATABASE_URL is set correctly and database is accessible'
    );
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
