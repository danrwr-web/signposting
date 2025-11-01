-- AddSymptomHistoryAuditFields
-- Add lastEditedBy and lastEditedAt to BaseSymptom
ALTER TABLE "BaseSymptom" ADD COLUMN IF NOT EXISTS "lastEditedBy" TEXT;

ALTER TABLE "BaseSymptom" ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP(3);

-- Add lastEditedBy and lastEditedAt to SurgerySymptomOverride
ALTER TABLE "SurgerySymptomOverride" ADD COLUMN IF NOT EXISTS "lastEditedBy" TEXT;

ALTER TABLE "SurgerySymptomOverride" ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP(3);

-- Add lastEditedBy and lastEditedAt to SurgeryCustomSymptom
ALTER TABLE "SurgeryCustomSymptom" ADD COLUMN IF NOT EXISTS "lastEditedBy" TEXT;

ALTER TABLE "SurgeryCustomSymptom" ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP(3);

-- CreateSymptomHistory
CREATE TABLE IF NOT EXISTS "SymptomHistory" (
    "id" TEXT NOT NULL,
    "symptomId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "previousText" TEXT,
    "newText" TEXT NOT NULL,
    "editorName" TEXT,
    "editorEmail" TEXT,
    "modelUsed" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SymptomHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SymptomHistory_symptomId_idx" ON "SymptomHistory"("symptomId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SymptomHistory_source_idx" ON "SymptomHistory"("source");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SymptomHistory_changedAt_idx" ON "SymptomHistory"("changedAt");

