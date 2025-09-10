-- CreateTable
CREATE TABLE "public"."Patient" (
    "id" TEXT NOT NULL,
    "abhaId" TEXT,
    "data" JSONB NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Encounter" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Condition" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "namasteCode" TEXT NOT NULL,
    "icdCode" TEXT,
    "data" JSONB NOT NULL,

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Patient_abhaId_key" ON "public"."Patient"("abhaId");

-- AddForeignKey
ALTER TABLE "public"."Encounter" ADD CONSTRAINT "Encounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Condition" ADD CONSTRAINT "Condition_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "public"."Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Condition" ADD CONSTRAINT "Condition_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
