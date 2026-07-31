-- CreateTable: SymptomImage (inline images in symptom instructions).
-- surgeryId is null for global images used in base-symptom content.
CREATE TABLE IF NOT EXISTS "SymptomImage" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SymptomImage_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "SymptomImage_surgeryId_idx" ON "SymptomImage" ("surgeryId");
CREATE INDEX IF NOT EXISTS "SymptomImage_createdByUserId_idx" ON "SymptomImage" ("createdByUserId");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SymptomImage_surgeryId_fkey') THEN
    ALTER TABLE "SymptomImage" ADD CONSTRAINT "SymptomImage_surgeryId_fkey"
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SymptomImage_createdByUserId_fkey') THEN
    ALTER TABLE "SymptomImage" ADD CONSTRAINT "SymptomImage_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
