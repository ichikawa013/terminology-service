-- CreateTable
CREATE TABLE "public"."CodeSystem" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Concept" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "codeSystemId" TEXT NOT NULL,

    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Concept" ADD CONSTRAINT "Concept_codeSystemId_fkey" FOREIGN KEY ("codeSystemId") REFERENCES "public"."CodeSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
