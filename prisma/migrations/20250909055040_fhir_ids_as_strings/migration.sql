/*
  Warnings:

  - The primary key for the `ConceptMap` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `ConceptMap` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."ConceptMap" DROP CONSTRAINT "ConceptMap_pkey",
DROP COLUMN "createdAt",
ADD COLUMN     "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "ConceptMap_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "ConceptMap_id_seq";
