ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

CREATE TYPE "PaymentStatus" AS ENUM ('NONE', 'PENDING', 'PAID', 'FAILED', 'REFUNDED');

CREATE TABLE "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "stripeCustomerId";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "stripeSubId";
ALTER TABLE "subscriptions" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'PAYFAST_SANDBOX';
ALTER TABLE "subscriptions" ADD COLUMN "providerPaymentId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "subscriptions" ADD COLUMN "paymentUrl" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "pendingPlan" "PlanType";
ALTER TABLE "subscriptions" ADD COLUMN "trialStartAt" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "trialEndAt" TIMESTAMP(3);

CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

ALTER TABLE "users"
  ADD CONSTRAINT "users_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
