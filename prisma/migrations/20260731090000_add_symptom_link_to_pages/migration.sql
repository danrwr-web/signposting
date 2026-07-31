-- Add multi-link support to symptoms. linkToPages stores a JSON array of
-- related-symptom names; the legacy linkToPage column stays as a synced
-- mirror of the first entry for not-yet-updated readers.
ALTER TABLE "BaseSymptom" ADD COLUMN IF NOT EXISTS "linkToPages" JSONB;
ALTER TABLE "SurgerySymptomOverride" ADD COLUMN IF NOT EXISTS "linkToPages" JSONB;
ALTER TABLE "SurgeryCustomSymptom" ADD COLUMN IF NOT EXISTS "linkToPages" JSONB;

-- Backfill from the single-value field. Overrides keep NULL semantics
-- (inherit); only non-blank legacy values become one-element arrays.
UPDATE "BaseSymptom"
SET "linkToPages" = to_jsonb(ARRAY[btrim("linkToPage")])
WHERE "linkToPages" IS NULL AND "linkToPage" IS NOT NULL AND btrim("linkToPage") <> '';

UPDATE "SurgerySymptomOverride"
SET "linkToPages" = to_jsonb(ARRAY[btrim("linkToPage")])
WHERE "linkToPages" IS NULL AND "linkToPage" IS NOT NULL AND btrim("linkToPage") <> '';

UPDATE "SurgeryCustomSymptom"
SET "linkToPages" = to_jsonb(ARRAY[btrim("linkToPage")])
WHERE "linkToPages" IS NULL AND "linkToPage" IS NOT NULL AND btrim("linkToPage") <> '';
