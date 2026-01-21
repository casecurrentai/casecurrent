-- Add elevenLabsId column to calls table for ElevenLabs conversation_id
ALTER TABLE "calls" ADD COLUMN "elevenlabs_id" TEXT;

-- Create unique index on elevenLabsId (nullable unique)
CREATE UNIQUE INDEX "calls_elevenlabs_id_key" ON "calls"("elevenlabs_id");

-- Create webhook_events table for idempotency tracking
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on provider + external_id + event_type for idempotency
CREATE UNIQUE INDEX "webhook_events_provider_external_id_event_type_key" ON "webhook_events"("provider", "external_id", "event_type");
