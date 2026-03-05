-- CreateTable
CREATE TABLE "BulkGenerationRun" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "createdBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalSubsections" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "failedSubsections" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BulkGenerationRun_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "DailyDoseGenerationJob" ADD COLUMN "bulkRunId" TEXT,
ADD COLUMN "categoryId" TEXT,
ADD COLUMN "categoryName" TEXT,
ADD COLUMN "subsection" TEXT;

-- CreateIndex
CREATE INDEX "BulkGenerationRun_surgeryId_idx" ON "BulkGenerationRun"("surgeryId");

-- CreateIndex
CREATE INDEX "BulkGenerationRun_status_idx" ON "BulkGenerationRun"("status");

-- CreateIndex
CREATE INDEX "BulkGenerationRun_createdBy_idx" ON "BulkGenerationRun"("createdBy");

-- CreateIndex
CREATE INDEX "DailyDoseGenerationJob_bulkRunId_idx" ON "DailyDoseGenerationJob"("bulkRunId");

-- AddForeignKey
ALTER TABLE "BulkGenerationRun" ADD CONSTRAINT "BulkGenerationRun_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkGenerationRun" ADD CONSTRAINT "BulkGenerationRun_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseGenerationJob" ADD CONSTRAINT "DailyDoseGenerationJob_bulkRunId_fkey" FOREIGN KEY ("bulkRunId") REFERENCES "BulkGenerationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
