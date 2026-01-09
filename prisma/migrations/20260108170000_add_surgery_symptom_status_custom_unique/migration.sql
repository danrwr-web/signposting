-- Ensure SurgerySymptomStatus can be upserted by (surgeryId, customSymptomId).
-- First, dedupe any existing rows that would violate the new uniqueness rule.

-- Remove duplicates where customSymptomId is set (keep the first by id).
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "surgeryId", "customSymptomId"
      ORDER BY "id" ASC
    ) AS rn
  FROM "SurgerySymptomStatus"
  WHERE "customSymptomId" IS NOT NULL
)
DELETE FROM "SurgerySymptomStatus"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);

-- Add uniqueness to support Prisma upsert selector `surgeryId_customSymptomId`.
CREATE UNIQUE INDEX IF NOT EXISTS "SurgerySymptomStatus_surgeryId_customSymptomId_key"
ON "SurgerySymptomStatus" ("surgeryId", "customSymptomId");

