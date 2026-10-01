/*
  Warnings:

  - You are about to drop the column `averageRating` on the `drivers` table. All the data in the column will be lost.
  - You are about to drop the column `totalRatings` on the `drivers` table. All the data in the column will be lost.
  - You are about to drop the `driver_ratings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "driver_ratings" DROP CONSTRAINT "driver_ratings_driverId_fkey";

-- AlterTable
ALTER TABLE "drivers" DROP COLUMN "averageRating",
DROP COLUMN "totalRatings";

-- DropTable
DROP TABLE "driver_ratings";
