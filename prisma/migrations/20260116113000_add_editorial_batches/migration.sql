-- AlterTable
ALTER TABLE "DailyDoseCard"
  ADD COLUMN "batchId" TEXT,
  ADD COLUMN "targetRole" TEXT NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "interactions" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "slotLanguage" JSONB,
  ADD COLUMN "safetyNetting" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "estimatedTimeMinutes" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
  ADD COLUMN "needsSourcing" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishedBy" TEXT,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "clinicianApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "clinicianApprovedBy" TEXT,
  ADD COLUMN "clinicianApprovedAt" TIMESTAMP(3),
  ADD COLUMN "generatedFrom" JSONB;

-- CreateTable
CREATE TABLE "DailyDoseGenerationBatch" (
  "id" TEXT NOT NULL,
  "surgeryId" TEXT NOT NULL,
  "createdBy" TEXT,
  "promptText" TEXT NOT NULL,
  "targetRole" TEXT NOT NULL,
  "modelUsed" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyDoseGenerationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDoseQuiz" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "surgeryId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "questions" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyDoseQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyDoseCard_batchId_idx" ON "DailyDoseCard"("batchId");

-- CreateIndex
CREATE INDEX "DailyDoseGenerationBatch_surgeryId_idx" ON "DailyDoseGenerationBatch"("surgeryId");

-- CreateIndex
CREATE INDEX "DailyDoseGenerationBatch_createdBy_idx" ON "DailyDoseGenerationBatch"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "DailyDoseQuiz_batchId_key" ON "DailyDoseQuiz"("batchId");

-- CreateIndex
CREATE INDEX "DailyDoseQuiz_surgeryId_idx" ON "DailyDoseQuiz"("surgeryId");

-- AddForeignKey
ALTER TABLE "DailyDoseGenerationBatch" ADD CONSTRAINT "DailyDoseGenerationBatch_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseGenerationBatch" ADD CONSTRAINT "DailyDoseGenerationBatch_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseCard" ADD CONSTRAINT "DailyDoseCard_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DailyDoseGenerationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseCard" ADD CONSTRAINT "DailyDoseCard_publishedBy_fkey" FOREIGN KEY ("publishedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseCard" ADD CONSTRAINT "DailyDoseCard_clinicianApprovedBy_fkey" FOREIGN KEY ("clinicianApprovedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseQuiz" ADD CONSTRAINT "DailyDoseQuiz_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DailyDoseGenerationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseQuiz" ADD CONSTRAINT "DailyDoseQuiz_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
