ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "trialUsed" BOOLEAN NOT NULL DEFAULT false;

UPDATE "subscriptions"
SET "trialUsed" = true
WHERE "trialStartAt" IS NOT NULL OR "status" = 'TRIALING';

ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
