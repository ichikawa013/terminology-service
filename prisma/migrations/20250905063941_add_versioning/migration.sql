/*
  Warnings:

  - You are about to drop the column `createdAt` on the `CodeSystem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."CodeSystem" DROP COLUMN "createdAt",
ADD COLUMN     "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
