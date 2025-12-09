/**
 * Engine service wrapper
 * Orchestrates engine, LLM, caching, and database
 */

import {
  sanitizeSQL,
  fingerprint,
  analyzeExplainPlan,
  parsePostgresExplainJson,
  parsePostgresExplainText,
  parseMysqlExplainJson,
  parseSqliteExplainQueryPlan,
} from '@sql-playground/engine';
import type { ExplanationResult, ExplainNode } from '@sql-playground/engine';
import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/db.js';
import { createLLMProvider } from './llmProvider.js';

const logger = createLogger({ module: 'engine_service' });

/**
 * Main service function: explain SQL query
 */
export async function explainSQLService(
  originalSql: string,
  sanitizedSql: string,
  dialect: string,
  schema?: string,
  explainPlan?: string
): Promise<ExplanationResult> {
  const llmProvider = createLLMProvider();

  logger.debug(
    { dialect, hasSchema: !!schema },
    'Explaining SQL'
  );

  // Parse EXPLAIN plan if provided
  let parsedPlan: ExplainNode | undefined;
  if (explainPlan) {
    try {
      parsedPlan = parseExplainPlan(explainPlan, dialect);
    } catch (error) {
      logger.warn({ error }, 'Failed to parse EXPLAIN plan');
    }
  }

  // Call LLM for explanation
  const explanation = await llmProvider.explainSQL({
    sql: originalSql,
    sanitizedSql,
    dialect,
    schema,
    explainPlan: explainPlan || (parsedPlan ? JSON.stringify(parsedPlan) : undefined),
    privacyMode: true,
  });

  // Enrich with fingerprint and heuristics
  const fp = fingerprint(originalSql);

  if (parsedPlan) {
    const heuristics = analyzeExplainPlan(parsedPlan);
    // Merge heuristics into explanation optimizations
    explanation.optimizations.push(
      ...heuristics.recommendations.map((rec: any) => {
        const severity = rec.reason.includes('missing') || rec.reason.includes('sequential')
          ? 'high'
          : 'medium';
        return {
          title: `Add ${rec.type} index on ${rec.table}(${rec.columns.join(',')})`,
          severity: severity as 'low' | 'medium' | 'high',
          reason: rec.reason,
          change: `CREATE INDEX idx_${rec.table}_${rec.columns[0]} ON ${rec.table}(${rec.columns.join(',')})`,
          estimatedImpact: '2-10x faster queries',
        };
      })
    );
  }

  // Cache in database
  try {
    const sanitized = sanitizeSQL(originalSql, { enabled: true });
    await prisma.explanationCache.create({
      data: {
        queryHash: fp.hash,
        queryPattern: fp.pattern,
        sql: originalSql,
        sanitizedSql: sanitized.sanitized,
        dialect,
        explanation: explanation as any,
        confidence: explanation.confidence,
      },
    });
  } catch (error) {
    logger.warn({ error }, 'Failed to cache explanation in database');
  }

  return explanation;
}

/**
 * Parse EXPLAIN output based on dialect
 */
function parseExplainPlan(explainOutput: string, dialect: string): ExplainNode {
  if (dialect === 'postgres') {
    // Try JSON first
    try {
      const parsed = JSON.parse(explainOutput);
      if (Array.isArray(parsed)) {
        return parsePostgresExplainJson(parsed);
      }
    } catch {
      // Fall back to text
      return parsePostgresExplainText(explainOutput);
    }
  }

  if (dialect === 'mysql') {
    try {
      const parsed = JSON.parse(explainOutput);
      return parseMysqlExplainJson(parsed);
    } catch {
      // MySQL table format not implemented yet
      throw new Error('MySQL text format EXPLAIN not yet supported');
    }
  }

  if (dialect === 'sqlite') {
    return parseSqliteExplainQueryPlan(explainOutput);
  }

  throw new Error(`Unsupported dialect: ${dialect}`);
}
