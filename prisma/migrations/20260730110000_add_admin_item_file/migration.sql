-- CreateTable: AdminItemFile
CREATE TABLE IF NOT EXISTS "AdminItemFile" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "adminItemId" TEXT,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminItemFile_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "AdminItemFile_surgeryId_idx" ON "AdminItemFile" ("surgeryId");
CREATE INDEX IF NOT EXISTS "AdminItemFile_adminItemId_idx" ON "AdminItemFile" ("adminItemId");
CREATE INDEX IF NOT EXISTS "AdminItemFile_createdByUserId_idx" ON "AdminItemFile" ("createdByUserId");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItemFile_surgeryId_fkey') THEN
    ALTER TABLE "AdminItemFile" ADD CONSTRAINT "AdminItemFile_surgeryId_fkey"
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItemFile_adminItemId_fkey') THEN
    ALTER TABLE "AdminItemFile" ADD CONSTRAINT "AdminItemFile_adminItemId_fkey"
      FOREIGN KEY ("adminItemId") REFERENCES "AdminItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItemFile_createdByUserId_fkey') THEN
    ALTER TABLE "AdminItemFile" ADD CONSTRAINT "AdminItemFile_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
