-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "onboarding_completed_at" TIMESTAMP(3),
ADD COLUMN     "onboarding_status" TEXT NOT NULL DEFAULT 'not_started',
ADD COLUMN     "plan_tier" TEXT,
ADD COLUMN     "primary_phone_number_id" TEXT,
ADD COLUMN     "subscription_status" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_login_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_invites" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_health_snapshots" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "snapshot_at" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_invites_token_key" ON "user_invites"("token");

-- AddForeignKey
ALTER TABLE "user_invites" ADD CONSTRAINT "user_invites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_health_snapshots" ADD CONSTRAINT "org_health_snapshots_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
