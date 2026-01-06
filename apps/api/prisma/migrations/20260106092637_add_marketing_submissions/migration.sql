-- CreateTable
CREATE TABLE "marketing_submissions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firm" TEXT,
    "phone" TEXT,
    "practice_area" TEXT,
    "current_intake_method" TEXT,
    "monthly_lead_volume" TEXT,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_submissions_pkey" PRIMARY KEY ("id")
);
