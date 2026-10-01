ALTER TABLE "subscriptions" ALTER COLUMN "provider" SET DEFAULT 'STRIPE_TEST';

UPDATE "subscriptions"
SET "provider" = 'STRIPE_TEST'
WHERE "provider" = 'PAYFAST_SANDBOX';
