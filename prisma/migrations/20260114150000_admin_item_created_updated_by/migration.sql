-- Admin Toolkit: record item creator + last editor

ALTER TABLE "AdminItem"
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "updatedByUserId" TEXT;

ALTER TABLE "AdminItem"
  ADD CONSTRAINT "AdminItem_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminItem"
  ADD CONSTRAINT "AdminItem_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AdminItem_createdByUserId_idx" ON "AdminItem"("createdByUserId");
CREATE INDEX "AdminItem_updatedByUserId_idx" ON "AdminItem"("updatedByUserId");

-- Backfill from existing owner field (best-effort, no invention)
UPDATE "AdminItem"
SET "createdByUserId" = "ownerUserId"
WHERE "createdByUserId" IS NULL AND "ownerUserId" IS NOT NULL;

UPDATE "AdminItem"
SET "updatedByUserId" = "ownerUserId"
WHERE "updatedByUserId" IS NULL AND "ownerUserId" IS NOT NULL;

