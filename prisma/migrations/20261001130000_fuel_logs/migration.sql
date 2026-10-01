-- CreateTable
CREATE TABLE IF NOT EXISTS "fuel_logs" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "odometer" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuel_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "fuel_logs_vehicleId_idx" ON "fuel_logs"("vehicleId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fuel_logs_vehicleId_fkey'
  ) THEN
    ALTER TABLE "fuel_logs"
      ADD CONSTRAINT "fuel_logs_vehicleId_fkey"
      FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
