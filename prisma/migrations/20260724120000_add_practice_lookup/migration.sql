-- AddColumn: odsCode on SalesPipeline (national ODS practice record matched at entry time)
ALTER TABLE "SalesPipeline" ADD COLUMN IF NOT EXISTS "odsCode" TEXT;

-- CreateTable: NationalPracticeData (monthly list-size cache from NHS Digital publication)
CREATE TABLE IF NOT EXISTS "NationalPracticeData" (
    "id" TEXT NOT NULL,
    "odsCode" TEXT NOT NULL,
    "listSize" INTEGER NOT NULL,
    "extractDate" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NationalPracticeData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NationalPracticeData_odsCode_key" ON "NationalPracticeData"("odsCode");
