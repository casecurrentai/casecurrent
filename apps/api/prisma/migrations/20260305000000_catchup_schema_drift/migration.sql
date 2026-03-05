-- ============================================================
-- Catch-up migration: align DB with Prisma schema
--
-- All statements use IF NOT EXISTS / idempotent forms so this
-- migration is safe to run against a DB that already has some
-- of these columns (e.g. via prisma db push).
-- ============================================================

-- ── calls: missing operational columns ───────────────────────────────────────
ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "call_outcome"   TEXT,
  ADD COLUMN IF NOT EXISTS "resolved"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "resolved_at"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "resolved_by"    TEXT,
  ADD COLUMN IF NOT EXISTS "twilio_call_sid" TEXT;

-- Make provider_call_id nullable (was NOT NULL in init, nullable in schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls'
      AND column_name = 'provider_call_id'
      AND is_nullable = 'NO'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE "calls" ALTER COLUMN "provider_call_id" DROP NOT NULL;
  END IF;
END $$;

-- Unique partial index for twilio_call_sid (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS "calls_twilio_call_sid_key"
  ON "calls"("twilio_call_sid")
  WHERE "twilio_call_sid" IS NOT NULL;

-- ── leads: lifecycle / funnel tracking columns ────────────────────────────────
ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "display_name"             TEXT,
  ADD COLUMN IF NOT EXISTS "score"                    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "score_label"              TEXT,
  ADD COLUMN IF NOT EXISTS "score_reasons"            JSONB,
  ADD COLUMN IF NOT EXISTS "urgency"                  TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS "intake_data"              JSONB,
  ADD COLUMN IF NOT EXISTS "owner_user_id"            TEXT,
  ADD COLUMN IF NOT EXISTS "next_step"                TEXT,
  ADD COLUMN IF NOT EXISTS "dnc"                      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dnc_reason"               TEXT,
  ADD COLUMN IF NOT EXISTS "dnc_at"                   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "last_activity_at"         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "last_human_response_at"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "first_contact_at"         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "consult_scheduled_at"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "consult_completed_at"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "retainer_sent_at"         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "retainer_signed_at"       TIMESTAMPTZ;

-- Add FK for owner_user_id only if users table exists and col is freshly added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'leads_owner_user_id_fkey'
  ) THEN
    -- Only add FK if the column exists (it was just added above)
    ALTER TABLE "leads"
      ADD CONSTRAINT "leads_owner_user_id_fkey"
      FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── contacts: name decomposition columns ──────────────────────────────────────
ALTER TABLE "contacts"
  ADD COLUMN IF NOT EXISTS "first_name" TEXT,
  ADD COLUMN IF NOT EXISTS "last_name"  TEXT;

-- ── users: intake routing flag ────────────────────────────────────────────────
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "intake_enabled" BOOLEAN NOT NULL DEFAULT true;

-- ── phone_numbers: source tracking + on-call routing ─────────────────────────
ALTER TABLE "phone_numbers"
  ADD COLUMN IF NOT EXISTS "source_tag"    TEXT,
  ADD COLUMN IF NOT EXISTS "on_call_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "routing"       JSONB;

-- ── leads: indexes for dashboard query performance ───────────────────────────
CREATE INDEX IF NOT EXISTS "leads_org_id_created_at_idx" ON "leads"("org_id", "created_at");
CREATE INDEX IF NOT EXISTS "leads_org_id_score_idx"      ON "leads"("org_id", "score");
CREATE INDEX IF NOT EXISTS "leads_retainer_signed_at_idx" ON "leads"("retainer_signed_at")
  WHERE "retainer_signed_at" IS NOT NULL;

-- ── calls: indexes for dashboard rescue-queue query ──────────────────────────
CREATE INDEX IF NOT EXISTS "calls_org_direction_resolved_idx"
  ON "calls"("org_id", "direction", "resolved");
CREATE INDEX IF NOT EXISTS "calls_org_id_created_at_idx" ON "calls"("org_id", "created_at");
