-- CreateTable
CREATE TABLE "DailyDoseGenerationAttempt" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "attemptIndex" INTEGER NOT NULL DEFAULT 0,
  "batchId" TEXT,
  "surgeryId" TEXT,
  "createdBy" TEXT,
  "promptText" TEXT NOT NULL,
  "targetRole" TEXT NOT NULL,
  "modelName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'FAILED',
  "rawModelOutput" TEXT NOT NULL,
  "rawModelJson" JSONB,
  "validationErrors" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyDoseGenerationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyDoseGenerationAttempt_requestId_idx" ON "DailyDoseGenerationAttempt"("requestId");

-- CreateIndex
CREATE INDEX "DailyDoseGenerationAttempt_batchId_idx" ON "DailyDoseGenerationAttempt"("batchId");

-- CreateIndex
CREATE INDEX "DailyDoseGenerationAttempt_surgeryId_idx" ON "DailyDoseGenerationAttempt"("surgeryId");

-- CreateIndex
CREATE INDEX "DailyDoseGenerationAttempt_createdBy_idx" ON "DailyDoseGenerationAttempt"("createdBy");

-- AddForeignKey
ALTER TABLE "DailyDoseGenerationAttempt" ADD CONSTRAINT "DailyDoseGenerationAttempt_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DailyDoseGenerationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseGenerationAttempt" ADD CONSTRAINT "DailyDoseGenerationAttempt_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseGenerationAttempt" ADD CONSTRAINT "DailyDoseGenerationAttempt_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
