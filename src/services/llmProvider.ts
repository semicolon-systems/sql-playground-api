/**
 * LLM Provider interface and implementations
 * Abstracts different LLM backends (OpenAI, local stub, etc.)
 */

import { createLogger } from '../lib/logger.js';
import type { ExplanationResult } from '@sql-playground/engine';

const logger = createLogger({ module: 'llm' });

/**
 * LLM Provider interface
 */
export interface LLMProvider {
  /**
   * Explain SQL query
   */
  explainSQL(request: LLMRequest): Promise<ExplanationResult>;
}

/**
 * Request parameters for LLM
 */
export interface LLMRequest {
  sql: string;
  sanitizedSql?: string;
  dialect: string;
  schema?: string;
  explainPlan?: string;
  privacyMode: boolean;
}

/**
 * Default system prompt for SQL explanation
 */
const SYSTEM_PROMPT = `You are SQLExplainAssistant. Your job: convert input {sql, dialect, schemaSummary, explainPlan?} into a structured JSON explanation following the schema below. Always assume privacy_mode=true unless provided otherwise. If privacy_mode=true, the SQL may already be anonymized with tokens like <str_0>, <num_1>. Output strictly valid JSON that matches the schema. Do not add commentary outside JSON. Keep answers concise and actionable.

Expected JSON Schema:
{
  "summary": "one-line plain-English summary of intent",
  "walkthrough": ["short numbered steps of what the query does"],
  "planAnalysis": [
    {
      "nodeId": "string",
      "operation": "SeqScan|IndexScan|IndexOnlyScan|BitmapHeapScan|HashJoin|NestedLoop|Sort|Aggregate|Limit|Other",
      "estimatedRows": number|null,
      "actualRows": number|null,
      "cost": {"startup": number,"total": number}|null,
      "hotnessScore": number,
      "explanation": "short note about this node"
    }
  ],
  "optimizations": [
    {
      "title": "short title",
      "severity": "low|medium|high",
      "reason": "why",
      "change": "SQL statement or action to take",
      "estimatedImpact": "qualitative impact description"
    }
  ],
  "antipatterns": [
    {
      "name": "pattern name",
      "severity": "low|medium|high",
      "explain": "explanation"
    }
  ],
  "rewrittenSQL": "if applicable, optimized SQL string",
  "confidence": "low|medium|high"
}

Few-shot example:
Input SQL: SELECT name FROM users WHERE created_at > '2024-01-01';
Output: {"summary":"Find users created since Jan 1, 2024.","walkthrough":["Filter users table by created_at","Return name column"],"planAnalysis":[{"nodeId":"1","operation":"SeqScan","estimatedRows":1000,"actualRows":null,"cost":{"startup":0,"total":100},"hotnessScore":80,"explanation":"Sequential scan without index"}],"optimizations":[{"title":"Add index on created_at","severity":"high","reason":"Sequential scan on filtered column","change":"CREATE INDEX idx_users_created_at ON users(created_at)","estimatedImpact":"10x faster for date filters"}],"antipatterns":[],"rewrittenSQL":"SELECT name FROM users WHERE created_at > '2024-01-01';","confidence":"high"}`;

/**
 * OpenAI implementation
 */
export class OpenAIProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }
  }

  async explainSQL(request: LLMRequest): Promise<ExplanationResult> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: this.apiKey });

    const content = this.buildPrompt(request);

    logger.debug({ sql: request.sql }, 'Calling OpenAI');

    const message = await client.chat.completions.create({
      model: 'gpt-4-turbo',
      max_tokens: 2048,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content,
        },
      ],
    } as any);

    const responseText =
      message.choices[0]?.message?.content || '';

    try {
      const result = JSON.parse(responseText) as ExplanationResult;
      logger.debug({ resultSummary: result.summary }, 'OpenAI response parsed');
      return result;
    } catch (error) {
      logger.error({ error, responseText }, 'Failed to parse OpenAI response');
      throw new Error('Invalid LLM response format');
    }
  }

  private buildPrompt(request: LLMRequest): string {
    const sql = request.privacyMode ? request.sanitizedSql || request.sql : request.sql;
    let prompt = `Analyze this ${request.dialect} SQL query:\n\n${sql}`;

    if (request.schema) {
      prompt += `\n\nSchema: ${request.schema}`;
    }

    if (request.explainPlan) {
      prompt += `\n\nEXPLAIN output:\n${request.explainPlan}`;
    }

    prompt += '\n\nPrivacy mode: ' + (request.privacyMode ? 'enabled' : 'disabled');
    prompt += '\n\nRespond with JSON only.';

    return prompt;
  }
}

/**
 * Local stub provider for testing
 * Returns deterministic canned responses
 */
export class LocalStubProvider implements LLMProvider {
  async explainSQL(request: LLMRequest): Promise<ExplanationResult> {
    logger.info({ sql: request.sql }, 'Using LocalStubProvider (mock)');

    // Simple heuristic: detect query type from SQL
    const isSelect = request.sql.toUpperCase().includes('SELECT');
    const isJoin = request.sql.toUpperCase().includes('JOIN');
    const hasWhere = request.sql.toUpperCase().includes('WHERE');

    return {
      summary: isSelect
        ? `Execute a ${isJoin ? 'join ' : ''}SELECT query${hasWhere ? ' with filtering' : ''}`
        : 'Execute a data modification',
      walkthrough: [
        isSelect ? 'Parse SELECT columns' : 'Parse statement',
        isJoin ? 'Join tables' : 'Access table',
        hasWhere ? 'Apply WHERE filters' : 'Process all rows',
        'Return results',
      ],
      planAnalysis: [
        {
          nodeId: 'node_0',
          operation: hasWhere ? 'SeqScan' : 'SeqScan',
          estimatedRows: 1000,
          actualRows: null,
          cost: { startup: 0, total: 100 },
          hotnessScore: hasWhere ? 75 : 30,
          explanation: 'Basic table scan',
        },
      ],
      optimizations: hasWhere
        ? [
            {
              title: 'Add index on filtered column',
              severity: 'medium',
              reason: 'WHERE clause would benefit from index',
              change: 'CREATE INDEX idx_filtered ON table(column)',
              estimatedImpact: '2-5x faster filtering',
            },
          ]
        : [],
      antipatterns: [],
      rewrittenSQL: request.sql,
      confidence: 'low',
      fingerprint: {
        hash: 'stub_hash_1234567890',
        pattern: 'STUB_PATTERN',
        tables: ['stub_table'],
        joinCount: isJoin ? 1 : 0,
        whereClauseComplexity: hasWhere ? 1 : 0,
      },
      executionTimeMs: Math.random() * 100,
    };
  }
}

/**
 * Factory function to create LLM provider
 */
export function createLLMProvider(providerName?: string): LLMProvider {
  const provider = providerName || process.env.LLM_PROVIDER || 'openai';

  if (provider === 'openai') {
    return new OpenAIProvider();
  }

  if (provider === 'stub' || process.env.NODE_ENV === 'test') {
    return new LocalStubProvider();
  }

  throw new Error(`Unknown LLM provider: ${provider}`);
}
