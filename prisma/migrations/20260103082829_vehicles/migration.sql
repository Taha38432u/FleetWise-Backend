-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'IDLE', 'IN_MAINTENANCE', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('TRUCK', 'VAN', 'CAR', 'BIKE');

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "mileage" INTEGER NOT NULL DEFAULT 0,
    "fuelEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastService" TIMESTAMP(3),
    "nextPredictedMaintenance" TIMESTAMP(3),
    "assignedDriver" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "fitnessExpiry" TIMESTAMP(3),
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_key" ON "vehicles"("plate");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "vehicles_plate_idx" ON "vehicles"("plate");
