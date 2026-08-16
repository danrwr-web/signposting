-- CreateTable: SymptomSmartVisual
CREATE TABLE IF NOT EXISTS "SymptomSmartVisual" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "symptomId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL DEFAULT '',
    "layoutJson" JSONB NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "modelUsed" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SymptomSmartVisual_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "SymptomSmartVisual_surgeryId_symptomId_variantKey_key"
  ON "SymptomSmartVisual" ("surgeryId", "symptomId", "variantKey");
CREATE INDEX IF NOT EXISTS "SymptomSmartVisual_surgeryId_idx" ON "SymptomSmartVisual" ("surgeryId");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SymptomSmartVisual_surgeryId_fkey') THEN
    ALTER TABLE "SymptomSmartVisual" ADD CONSTRAINT "SymptomSmartVisual_surgeryId_fkey"
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SymptomSmartVisual_generatedByUserId_fkey') THEN
    ALTER TABLE "SymptomSmartVisual" ADD CONSTRAINT "SymptomSmartVisual_generatedByUserId_fkey"
      FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
