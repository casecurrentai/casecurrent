-- Migration: call_ingestion_resilience
-- Adds finalization lifecycle tracking to calls and a parking table for
-- unlinked post-call payloads (ElevenLabs webhooks that arrive before the
-- Call row exists or before lead creation races are resolved).

-- ── Call: finalization lifecycle columns ────────────────────────────────────
ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "status"               TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "finalized_at"         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "last_finalize_error"  TEXT,
  ADD COLUMN IF NOT EXISTS "transcript_quality"   TEXT;

CREATE INDEX IF NOT EXISTS "calls_status_idx" ON "calls" ("status");

-- ── UnlinkedPostCall: parking lot for unresolved provider payloads ───────────
CREATE TABLE IF NOT EXISTS "unlinked_post_calls" (
  "id"                    TEXT        NOT NULL,
  "received_at"           TIMESTAMPTZ NOT NULL,
  "provider"              TEXT        NOT NULL,
  "twilio_call_sid"       TEXT,
  "elevenlabs_conv_id"    TEXT,
  "interaction_id"        TEXT,
  "raw_payload_json"      JSONB       NOT NULL,
  "correlation_keys_json" JSONB       NOT NULL,
  "last_retry_at"         TIMESTAMPTZ,
  "retry_count"           INTEGER     NOT NULL DEFAULT 0,
  "resolved_call_id"      TEXT,
  "resolved_at"           TIMESTAMPTZ,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "unlinked_post_calls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "unlinked_post_calls_provider_resolved_idx"
  ON "unlinked_post_calls" ("provider", "resolved_at");

CREATE INDEX IF NOT EXISTS "unlinked_post_calls_twilio_call_sid_idx"
  ON "unlinked_post_calls" ("twilio_call_sid");

CREATE INDEX IF NOT EXISTS "unlinked_post_calls_elevenlabs_conv_id_idx"
  ON "unlinked_post_calls" ("elevenlabs_conv_id");
