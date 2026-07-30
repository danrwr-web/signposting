-- CreateTable: AdminItemSmartVisual
CREATE TABLE IF NOT EXISTS "AdminItemSmartVisual" (
    "id" TEXT NOT NULL,
    "adminItemId" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "layoutJson" JSONB NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "modelUsed" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminItemSmartVisual_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "AdminItemSmartVisual_adminItemId_key" ON "AdminItemSmartVisual" ("adminItemId");
CREATE INDEX IF NOT EXISTS "AdminItemSmartVisual_surgeryId_idx" ON "AdminItemSmartVisual" ("surgeryId");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItemSmartVisual_adminItemId_fkey') THEN
    ALTER TABLE "AdminItemSmartVisual" ADD CONSTRAINT "AdminItemSmartVisual_adminItemId_fkey"
      FOREIGN KEY ("adminItemId") REFERENCES "AdminItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItemSmartVisual_surgeryId_fkey') THEN
    ALTER TABLE "AdminItemSmartVisual" ADD CONSTRAINT "AdminItemSmartVisual_surgeryId_fkey"
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItemSmartVisual_generatedByUserId_fkey') THEN
    ALTER TABLE "AdminItemSmartVisual" ADD CONSTRAINT "AdminItemSmartVisual_generatedByUserId_fkey"
      FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
