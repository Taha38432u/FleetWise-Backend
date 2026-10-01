-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "isVehicleAssigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vehicleAssignedId" TEXT;

-- CreateIndex
CREATE INDEX "drivers_vehicleAssignedId_idx" ON "drivers"("vehicleAssignedId");
