-- AlterTable
ALTER TABLE "referrals" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Backfill: set expiresAt = createdAt + 30 days for existing PENDING referrals
UPDATE "referrals"
SET "expiresAt" = "createdAt" + INTERVAL '30 days'
WHERE "status" = 'PENDING' AND "expiresAt" IS NULL;
