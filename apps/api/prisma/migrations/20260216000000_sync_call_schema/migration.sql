-- AlterTable: Add missing columns to calls table
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "end_reason" TEXT;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "structured_data" JSONB;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "success_evaluation" JSONB;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "messages_json" JSONB;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "raw_webhook_payload" JSONB;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "last_webhook_received_at" TIMESTAMP(3);

-- Add unique index on elevenlabs_id if not exists
CREATE UNIQUE INDEX IF NOT EXISTS "calls_elevenlabs_id_key" ON "calls"("elevenlabs_id");
