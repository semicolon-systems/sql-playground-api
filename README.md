# SQL Playground API

[![CI](https://github.com/sql-playground/sql-playground-api/workflows/CI/badge.svg)](https://github.com/sql-playground/sql-playground-api/actions)

Backend REST API for SQL Playground. Fastify-based service with PostgreSQL + Redis integration, LLM (OpenAI) integration, caching, and metrics.

## Features

- **Fastify REST API** with TypeScript strict mode
- **SQL Explanation** via OpenAI/Claude LLM with privacy mode
- **Redis Caching** with stampede protection and rate limiting
- **PostgreSQL** persistence for caching and audit logs
- **Prometheus Metrics** for monitoring
- **Request Logging** with Pino structured logging
- **CORS & Security** headers (Helmet)
- **Health Checks** and database monitoring

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 13+
- Redis 6+
- OpenAI API key (or use LocalStubProvider for testing)

### Setup

```bash
# Clone and install
git clone https://github.com/sql-playground/sql-playground-api.git
cd sql-playground-api
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database and API credentials

# Run migrations
npx prisma migrate deploy

# Start development server
npm run dev

# In another terminal, start watching TypeScript
npm run build -- --watch
```

Server starts on http://localhost:3000

### Docker

```bash
# Build image
docker build -t sql-playground-api:latest .

# Run with docker-compose (see infra repo)
docker-compose -f ../sql-playground-infra/docker-compose.yml up api
```

## API Endpoints

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-09T12:00:00Z",
  "services": {
    "api": "ok",
    "database": "ok",
    "cache": "ok"
  },
  "uptime": 3600
}
```

### `POST /v1/explain`

Explain a SQL query.

**Request:**
```json
{
  "sql": "SELECT u.id, u.name FROM users u JOIN orders o ON u.id = o.user_id WHERE o.total > 100",
  "dialect": "postgres",
  "schema": "users(id, name), orders(id, user_id, total)",
  "explainPlan": "... EXPLAIN output ...",
  "privacyMode": true,
  "cache": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": "Find users with orders exceeding $100",
    "walkthrough": ["..."],
    "planAnalysis": ["..."],
    "optimizations": ["..."],
    "antipatterns": [],
    "rewrittenSQL": "...",
    "confidence": "high",
    "cached": false,
    "fingerprint": {
      "hash": "abc123...",
      "tables": ["users", "orders"],
      "joinCount": 1
    }
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-12-09T12:00:00Z"
}
```

### `GET /v1/metrics`

Prometheus metrics endpoint.

**Response:** Prometheus text format metrics

### `GET /`

API info endpoint.

## Configuration

Environment variables in `.env`:

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/sql_playground"

# Redis
REDIS_URL="redis://localhost:6379"

# LLM
OPENAI_API_KEY="sk-..."
LLM_PROVIDER="openai"  # or "stub" for testing

# API
NODE_ENV="development"
PORT=3000
HOST="0.0.0.0"
LOG_LEVEL="info"

# Security
JWT_SECRET="your-secret-key"
CORS_ORIGIN="http://localhost:3001"

# Features
ENABLE_RATE_LIMITING=true
DEFAULT_PRIVACY_MODE=true
```

## LLM Providers

### OpenAI

Uses `openai` package with Claude 3.5 Sonnet or GPT-4.

```typescript
// Automatically selected if OPENAI_API_KEY is set
const provider = new OpenAIProvider();
```

### Local Stub (Testing)

Returns deterministic mock responses.

```typescript
// Automatically used in test environment
const provider = new LocalStubProvider();
```

## Database Schema

Prisma schema defines:

- `User` — Optional user accounts for auth and rate limiting
- `ExplanationCache` — Cached explanation results by query fingerprint (7-day TTL)
- `LLMRequest` — Audit log of all LLM API calls (tokens, costs, latency)
- `QueryStats` — Analytics on popular queries

Migrate:

```bash
npx prisma migrate dev --name "initial schema"
npx prisma migrate deploy  # Production
npx prisma studio          # Browse data
```

## Caching Strategy

- **Cache Key:** `explain:{fingerprint_hash}`
- **TTL:** 3600 seconds (1 hour) for explanations
- **Stampede Protection:** Distributed lock prevents concurrent computation
- **Rate Limiting:** Per-user/day token budget via Redis

## Testing

```bash
npm test              # Run unit + integration tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

Tests use:

- `vitest` — Test runner
- `LocalStubProvider` — Deterministic LLM mock
- In-memory mocks for Redis/Prisma (todo: add testcontainers for integration tests)

## Monitoring

### Prometheus Metrics

Available at `GET /v1/metrics`:

- `http_requests_total` — Requests by endpoint
- `http_request_duration_seconds` — Request latencies
- `cache_hits_total`, `cache_misses_total` — Cache performance
- `llm_calls_total` — LLM usage
- `llm_tokens_used_total` — Token consumption
- `db_query_duration_seconds` — DB latencies
- `active_requests` — Current requests

### Structured Logging

Pino logs include request IDs, error tracing, and service-specific context:

```
[12:00:00.123] INFO (explain_route): Cache hit for query
    requestId: "550e8400-e29b-41d4-a716-446655440000"
```

SQL is redacted from logs by default for privacy.

## Development

### File Structure

```
src/
  server.ts              # Fastify app + startup
  types.ts               # Zod schemas + TypeScript types
  routes/
    explain.ts           # /v1/explain endpoint
    health.ts            # /health endpoint
    metrics.ts           # /v1/metrics endpoint
  services/
    engineService.ts     # Engine orchestration
    llmProvider.ts       # LLM interface + implementations
  lib/
    logger.ts            # Pino logging
    cache.ts             # Redis wrapper
    db.ts                # Prisma singleton
    metrics.ts           # Prometheus exporter
prisma/
  schema.prisma          # Data models
  migrations/
```

### Adding Routes

1. Create file in `src/routes/myroute.ts`
2. Export `registerMyRouteRoutes(app: FastifyInstance)` function
3. Call from `server.ts`

### Adding LLM Providers

1. Implement `LLMProvider` interface
2. Add to `createLLMProvider()` factory
3. Set `LLM_PROVIDER` env var

## Deployment

### Docker

```bash
docker build -t sql-playground-api:latest .
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e REDIS_URL="..." \
  -e OPENAI_API_KEY="..." \
  sql-playground-api:latest
```

### Kubernetes

See `../sql-playground-infra` for Helm charts.

### Environment Setup

**Postgres:**
- Neon: `postgresql://user:pass@ep-xxx.neon.tech/dbname`
- AWS RDS: `postgresql://user:pass@rds-xxx.amazonaws.com/dbname`
- Supabase: `postgresql://postgres:pass@db-xxx.supabase.co/postgres`

**Redis:**
- Upstash: `redis://default:token@xxx.upstash.io`
- AWS ElastiCache: `redis://xxx.xxx.cache.amazonaws.com:6379`
- Redis Cloud: `redis://user:token@redis-xxx.redis.cloud:12345`

## License

MIT

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
