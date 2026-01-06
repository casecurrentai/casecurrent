-- CreateTable
CREATE TABLE "marketing_contact_submissions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firm" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_contact_submissions_pkey" PRIMARY KEY ("id")
);
