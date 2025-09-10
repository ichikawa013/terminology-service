-- CreateTable
CREATE TABLE "public"."Bundle" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConditionLog" (
    "id" TEXT NOT NULL,
    "namasteCode" TEXT NOT NULL,
    "icdCode" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConditionLog_pkey" PRIMARY KEY ("id")
);
