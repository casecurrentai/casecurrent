-- CreateTable
CREATE TABLE "ingestion_outcomes" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "org_id" TEXT,
    "status" TEXT NOT NULL,
    "error_code" TEXT,
    "error_message" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingestion_outcomes_provider_status_idx" ON "ingestion_outcomes"("provider", "status");

-- CreateIndex
CREATE INDEX "ingestion_outcomes_provider_created_at_idx" ON "ingestion_outcomes"("provider", "created_at");

-- CreateIndex
CREATE INDEX "ingestion_outcomes_status_created_at_idx" ON "ingestion_outcomes"("status", "created_at");
