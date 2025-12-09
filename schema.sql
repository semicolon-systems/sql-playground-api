-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "apiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "explanation_cache" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "queryHash" TEXT NOT NULL,
    "queryPattern" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "sanitizedSql" TEXT,
    "dialect" TEXT NOT NULL,
    "explanation" JSONB NOT NULL,
    "confidence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP + interval '7 days',
    "ttl" INTEGER NOT NULL DEFAULT 604800,

    CONSTRAINT "explanation_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sql" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "costUsd" DOUBLE PRECISION,

    CONSTRAINT "llm_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_stats" (
    "id" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "averageLatencyMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cacheHitRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topDiagnostics" JSONB NOT NULL,
    "lastRequestAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "query_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_apiKey_key" ON "users"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "explanation_cache_queryHash_key" ON "explanation_cache"("queryHash");

-- CreateIndex
CREATE INDEX "explanation_cache_queryHash_idx" ON "explanation_cache"("queryHash");

-- CreateIndex
CREATE INDEX "explanation_cache_createdAt_idx" ON "explanation_cache"("createdAt");

-- CreateIndex
CREATE INDEX "explanation_cache_expiresAt_idx" ON "explanation_cache"("expiresAt");

-- CreateIndex
CREATE INDEX "llm_requests_userId_idx" ON "llm_requests"("userId");

-- CreateIndex
CREATE INDEX "llm_requests_status_idx" ON "llm_requests"("status");

-- CreateIndex
CREATE INDEX "llm_requests_createdAt_idx" ON "llm_requests"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "query_stats_queryHash_key" ON "query_stats"("queryHash");

-- CreateIndex
CREATE INDEX "query_stats_lastRequestAt_idx" ON "query_stats"("lastRequestAt");

-- AddForeignKey
ALTER TABLE "explanation_cache" ADD CONSTRAINT "explanation_cache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_requests" ADD CONSTRAINT "llm_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

