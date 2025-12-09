/**
 * Core API types and request/response schemas
 */

import { z } from 'zod';

/**
 * Zod schema for /v1/explain POST request
 */
export const ExplainRequestSchema = z.object({
  sql: z.string().min(1, 'SQL required'),
  dialect: z.enum(['postgres', 'mysql', 'sqlite']).default('postgres'),
  schema: z.optional(z.string()),
  explainPlan: z.optional(z.string()),
  privacyMode: z.boolean().default(true),
  cache: z.boolean().default(true),
});

export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;

/**
 * Zod schema for /v1/plan POST request
 */
export const PlanRequestSchema = z.object({
  sql: z.string().min(1, 'SQL required'),
  dialect: z.enum(['postgres', 'mysql', 'sqlite']).default('postgres'),
  explain: z.boolean().default(true), // If true, execute EXPLAIN on DB
  schema: z.optional(z.string()),
});

export type PlanRequest = z.infer<typeof PlanRequestSchema>;

/**
 * API response wrapper for consistency
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  requestId: string;
  timestamp: string;
}

/**
 * Cached result metadata
 */
export interface CacheMetadata {
  key: string;
  hitAt?: string;
  expiresAt?: string;
  cached: boolean;
}
