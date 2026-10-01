ALTER TABLE "predictive_alerts"
ADD COLUMN "riskLevel" TEXT NOT NULL DEFAULT 'low',
ADD COLUMN "maintenancePriority" TEXT NOT NULL DEFAULT 'monitor',
ADD COLUMN "suggestedAction" TEXT,
ADD COLUMN "modelVersion" TEXT,
ADD COLUMN "dataQuality" TEXT;

CREATE INDEX "predictive_alerts_riskLevel_idx" ON "predictive_alerts"("riskLevel");
