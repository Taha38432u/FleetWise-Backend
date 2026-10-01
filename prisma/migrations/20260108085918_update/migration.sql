-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;
