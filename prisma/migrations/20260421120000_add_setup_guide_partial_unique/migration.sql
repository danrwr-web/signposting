-- De-duplicate any pre-existing standalone SetupGuide templates so the
-- partial unique index below can be created. Keeps the most recently
-- updated row.
DELETE FROM "DocumentTemplate" a
  USING "DocumentTemplate" b
  WHERE a."documentType" = 'SetupGuide'
    AND b."documentType" = 'SetupGuide'
    AND a."contractVariantId" IS NULL
    AND b."contractVariantId" IS NULL
    AND (a."updatedAt" < b."updatedAt"
      OR (a."updatedAt" = b."updatedAt" AND a."id" < b."id"));

-- Ensure at most one standalone SetupGuide template (contractVariantId IS NULL).
-- Prisma's @@unique([contractVariantId, documentType]) does not prevent
-- duplicates when contractVariantId is NULL because PostgreSQL treats NULLs
-- as distinct under a regular unique constraint.
CREATE UNIQUE INDEX "DocumentTemplate_setupGuide_standalone_unique"
  ON "DocumentTemplate" ("documentType")
  WHERE "contractVariantId" IS NULL;
