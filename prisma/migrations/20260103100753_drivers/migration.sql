/*
  Warnings:

  - You are about to drop the column `assignedDriver` on the `vehicles` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('VALID', 'EXPIRED', 'SUSPENDED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'ON_DUTY', 'OFF_DUTY', 'ON_LEAVE');

-- DropIndex
DROP INDEX "vehicles_plate_idx";

-- DropIndex
DROP INDEX "vehicles_status_idx";

-- AlterTable
ALTER TABLE "vehicles" DROP COLUMN "assignedDriver",
ADD COLUMN     "assignedDriverId" TEXT;

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseExpiry" TIMESTAMP(3) NOT NULL,
    "licenseStatus" "LicenseStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "licenseVerifiedAt" TIMESTAMP(3),
    "yearsOfExperience" INTEGER NOT NULL,
    "emergencyContact" TEXT NOT NULL,
    "emergencyContactPhone" TEXT NOT NULL,
    "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "totalRides" INTEGER NOT NULL DEFAULT 0,
    "totalDistance" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "totalRatings" INTEGER NOT NULL DEFAULT 0,
    "lastWorkingDate" TIMESTAMP(3),
    "documentVerified" BOOLEAN NOT NULL DEFAULT false,
    "backgroundCheckDone" BOOLEAN NOT NULL DEFAULT false,
    "backgroundCheckDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driving_records" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "startLocation" TEXT NOT NULL,
    "endLocation" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "distance" INTEGER NOT NULL,
    "fuelUsed" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driving_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_ratings" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "comment" TEXT,
    "ratedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drivers_userId_key" ON "drivers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_licenseNumber_key" ON "drivers"("licenseNumber");

-- CreateIndex
CREATE INDEX "drivers_userId_idx" ON "drivers"("userId");

-- CreateIndex
CREATE INDEX "drivers_licenseStatus_idx" ON "drivers"("licenseStatus");

-- CreateIndex
CREATE INDEX "drivers_availabilityStatus_idx" ON "drivers"("availabilityStatus");

-- CreateIndex
CREATE INDEX "driving_records_driverId_idx" ON "driving_records"("driverId");

-- CreateIndex
CREATE INDEX "attendance_records_driverId_idx" ON "attendance_records"("driverId");

-- CreateIndex
CREATE INDEX "attendance_records_date_idx" ON "attendance_records"("date");

-- CreateIndex
CREATE INDEX "driver_ratings_driverId_idx" ON "driver_ratings"("driverId");

-- CreateIndex
CREATE INDEX "vehicles_assignedDriverId_idx" ON "vehicles"("assignedDriverId");

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driving_records" ADD CONSTRAINT "driving_records_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_ratings" ADD CONSTRAINT "driver_ratings_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
