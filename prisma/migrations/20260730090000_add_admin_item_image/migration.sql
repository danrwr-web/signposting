-- CreateTable: AdminItemImage
CREATE TABLE IF NOT EXISTS "AdminItemImage" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "adminItemId" TEXT,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminItemImage_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "AdminItemImage_surgeryId_idx" ON "AdminItemImage" ("surgeryId");
CREATE INDEX IF NOT EXISTS "AdminItemImage_adminItemId_idx" ON "AdminItemImage" ("adminItemId");
CREATE INDEX IF NOT EXISTS "AdminItemImage_createdByUserId_idx" ON "AdminItemImage" ("createdByUserId");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItemImage_surgeryId_fkey') THEN
    ALTER TABLE "AdminItemImage" ADD CONSTRAINT "AdminItemImage_surgeryId_fkey"
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItemImage_adminItemId_fkey') THEN
    ALTER TABLE "AdminItemImage" ADD CONSTRAINT "AdminItemImage_adminItemId_fkey"
      FOREIGN KEY ("adminItemId") REFERENCES "AdminItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItemImage_createdByUserId_fkey') THEN
    ALTER TABLE "AdminItemImage" ADD CONSTRAINT "AdminItemImage_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
