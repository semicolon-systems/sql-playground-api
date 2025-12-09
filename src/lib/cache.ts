/**
 * Redis cache layer with stampede protection and expiration
 */

import { createClient } from 'redis';
import { createLogger } from './logger.js';

const logger = createLogger({ module: 'cache' });

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

client.on('error', (err) => logger.error({ err }, 'Redis error'));

/**
 * Initialize Redis connection
 */
export async function initCache(): Promise<void> {
  if (!client.isOpen) {
    const isUpstash = process.env.REDIS_URL?.includes('upstash.io');
    const provider = isUpstash ? 'Upstash' : 'Local/Custom Redis';

    logger.info(`Attempting ${provider} Redis connection...`);
    try {
      await client.connect();
      logger.info({ provider }, 'Redis connected successfully');
    } catch (error) {
      logger.warn({ error }, `${provider} connection failed, cache disabled`);
      // Don't throw - allow app to work without cache
    }
  }
}

/**
 * Disconnect Redis
 */
export async function closeCache(): Promise<void> {
  if (client.isOpen) {
    await client.quit();
    logger.info('Redis disconnected');
  }
}

const CACHE_TTL_SECONDS = 3600; // 1 hour
const STAMPEDE_LOCK_TTL_SECONDS = 10;

/**
 * Get value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await client.get(key);
    if (value) {
      return JSON.parse(value) as T;
    }
    return null;
  } catch (error) {
    logger.error({ key, error }, 'Cache get failed');
    return null;
  }
}

/**
 * Set value in cache with TTL
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttl?: number
): Promise<void> {
  try {
    await client.setEx(key, ttl || CACHE_TTL_SECONDS, JSON.stringify(value));
  } catch (error) {
    logger.error({ key, error }, 'Cache set failed');
  }
}

/**
 * Acquire stampede protection lock
 * Prevents multiple concurrent computations of same value
 */
export async function acquireStampedeLock(key: string): Promise<boolean> {
  try {
    const lockKey = `lock:${key}`;
    const acquired = await client.setNX(lockKey, '1');

    if (acquired) {
      await client.expire(lockKey, STAMPEDE_LOCK_TTL_SECONDS);
      return true;
    }
    return false;
  } catch (error) {
    logger.error({ key, error }, 'Stampede lock acquisition failed');
    return false;
  }
}

/**
 * Release stampede protection lock
 */
export async function releaseStampedeLock(key: string): Promise<void> {
  try {
    const lockKey = `lock:${key}`;
    await client.del(lockKey);
  } catch (error) {
    logger.error({ key, error }, 'Stampede lock release failed');
  }
}

/**
 * Record cache hit (for metrics)
 */
export function recordCacheHit(): void {
  // TODO: integrate with prom-client metrics
}

/**
 * Record cache miss (for metrics)
 */
export function recordCacheMiss(): void {
  // TODO: integrate with prom-client metrics
}

/**
 * Check rate limit (simple token bucket per user/day)
 */
export async function checkRateLimit(
  userId: string,
  maxTokens: number = 100
): Promise<boolean> {
  if (!process.env.ENABLE_RATE_LIMITING || process.env.ENABLE_RATE_LIMITING === 'false') {
    return true;
  }

  try {
    const key = `rate_limit:${userId}:${new Date().toISOString().split('T')[0]}`;
    const current = await client.incr(key);

    if (current === 1) {
      // First request of the day, set expiry
      await client.expire(key, 86400); // 24 hours
    }

    return current <= maxTokens;
  } catch (error) {
    logger.error({ userId, error }, 'Rate limit check failed');
    return true; // Fail open
  }
}

/**
 * Clear all cache (dangerous - use with caution)
 */
export async function flushCache(): Promise<void> {
  try {
    await client.flushDb();
    logger.info('Cache flushed');
  } catch (error) {
    logger.error({ error }, 'Cache flush failed');
  }
}
