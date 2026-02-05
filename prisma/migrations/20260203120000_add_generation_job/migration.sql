-- CreateTable
CREATE TABLE "DailyDoseGenerationJob" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "createdBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "batchId" TEXT,
    "promptText" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 5,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "interactiveFirst" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DailyDoseGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyDoseGenerationJob_batchId_key" ON "DailyDoseGenerationJob"("batchId");

-- CreateIndex
CREATE INDEX "DailyDoseGenerationJob_surgeryId_idx" ON "DailyDoseGenerationJob"("surgeryId");

-- CreateIndex
CREATE INDEX "DailyDoseGenerationJob_createdBy_idx" ON "DailyDoseGenerationJob"("createdBy");

-- CreateIndex
CREATE INDEX "DailyDoseGenerationJob_status_idx" ON "DailyDoseGenerationJob"("status");

-- AddForeignKey
ALTER TABLE "DailyDoseGenerationJob" ADD CONSTRAINT "DailyDoseGenerationJob_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseGenerationJob" ADD CONSTRAINT "DailyDoseGenerationJob_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseGenerationJob" ADD CONSTRAINT "DailyDoseGenerationJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DailyDoseGenerationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
