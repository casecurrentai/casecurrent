-- ============================================================
-- Migration: call_artifact_cache table
-- Stores TTL-cached Vapi call artifacts (transcript, recording, summary).
-- Fetched on-demand per call detail view, scoped by firm_id (= orgId).
-- TTL default: 6 hours. All statements idempotent (IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS "call_artifact_cache" (
  "id"           TEXT        NOT NULL,
  "firm_id"      TEXT        NOT NULL,
  "vapi_call_id" TEXT        NOT NULL,
  "kind"         TEXT        NOT NULL DEFAULT 'full_call',
  "payload_json" JSONB       NOT NULL,
  "fetched_at"   TIMESTAMPTZ NOT NULL,
  "expires_at"   TIMESTAMPTZ NOT NULL,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "call_artifact_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "call_artifact_cache_firm_call_kind_key"
  ON "call_artifact_cache"("firm_id", "vapi_call_id", "kind");

CREATE INDEX IF NOT EXISTS "call_artifact_cache_firm_vapi_idx"
  ON "call_artifact_cache"("firm_id", "vapi_call_id");

CREATE INDEX IF NOT EXISTS "call_artifact_cache_expires_idx"
  ON "call_artifact_cache"("expires_at");
