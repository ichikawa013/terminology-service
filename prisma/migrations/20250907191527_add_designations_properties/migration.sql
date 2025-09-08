/*
  Warnings:

  - A unique constraint covering the columns `[codeSystemId,code]` on the table `Concept` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Concept" ADD COLUMN     "designations" JSONB,
ADD COLUMN     "properties" JSONB,
ALTER COLUMN "definition" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Concept_codeSystemId_code_key" ON "public"."Concept"("codeSystemId", "code");
