ALTER TABLE "vehicles" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "accounts" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "budgets" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "goals" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "recurring_expenses" ADD COLUMN "organizationId" TEXT;

CREATE INDEX "vehicles_organizationId_idx" ON "vehicles"("organizationId");
CREATE INDEX "accounts_organizationId_idx" ON "accounts"("organizationId");
CREATE INDEX "transactions_organizationId_idx" ON "transactions"("organizationId");
CREATE INDEX "budgets_organizationId_idx" ON "budgets"("organizationId");
CREATE INDEX "goals_organizationId_idx" ON "goals"("organizationId");
CREATE INDEX "recurring_expenses_organizationId_idx" ON "recurring_expenses"("organizationId");

ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
