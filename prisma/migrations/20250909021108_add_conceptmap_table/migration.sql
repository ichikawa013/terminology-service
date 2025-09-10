-- CreateTable
CREATE TABLE "public"."ConceptMap" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "targetSystem" TEXT NOT NULL,
    "json" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptMap_pkey" PRIMARY KEY ("id")
);
