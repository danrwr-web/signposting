-- Unify symptom-content suggestions and app-level feedback into one Suggestion model.
-- Adds real type/status enums (previously status was JSON-encoded into the text
-- column as a workaround for the missing column), submitter/responder links, and
-- recovers legacy JSON-wrapped rows.

-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('FEATURE', 'IMPROVEMENT', 'BUG', 'SYMPTOM_CONTENT');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'PLANNED', 'DONE', 'DECLINED');

-- AlterTable
ALTER TABLE "Suggestion"
  ADD COLUMN "type" "SuggestionType" NOT NULL DEFAULT 'SYMPTOM_CONTENT',
  ADD COLUMN "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "title" TEXT,
  ADD COLUMN "pageContext" TEXT,
  ADD COLUMN "submittedByUserId" TEXT,
  ADD COLUMN "response" TEXT,
  ADD COLUMN "respondedByUserId" TEXT,
  ADD COLUMN "respondedAt" TIMESTAMP(3),
  ADD COLUMN "legacyAuditJson" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "symptom" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_submittedByUserId_fkey"
  FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_respondedByUserId_fkey"
  FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Suggestion_surgeryId_status_idx" ON "Suggestion"("surgeryId", "status");

-- CreateIndex
CREATE INDEX "Suggestion_type_status_idx" ON "Suggestion"("type", "status");

-- CreateIndex
CREATE INDEX "Suggestion_submittedByUserId_idx" ON "Suggestion"("submittedByUserId");

-- Existing rows: updatedAt should not postdate the migration.
UPDATE "Suggestion" SET "updatedAt" = "createdAt";

-- Recover rows whose text column holds the legacy JSON wrapper
-- {"originalText": ..., "status": "pending"|"actioned"|"discarded", "updatedAt": ..., "auditTrail": [...]}.
-- Per-row exception handling: a row that merely *looks* like JSON must not abort
-- the migration, it just stays as-is (status PENDING, text untouched).
DO $$
DECLARE
  r RECORD;
  parsed JSONB;
BEGIN
  FOR r IN
    SELECT id, text, "createdAt" FROM "Suggestion"
    WHERE text LIKE '{%' AND text LIKE '%"originalText"%' AND text LIKE '%"status"%'
  LOOP
    BEGIN
      parsed := r.text::jsonb;
      IF parsed ? 'originalText' AND parsed ? 'status' THEN
        UPDATE "Suggestion" SET
          text = COALESCE(parsed->>'originalText', text),
          status = CASE parsed->>'status'
                     WHEN 'actioned'  THEN 'DONE'::"SuggestionStatus"
                     WHEN 'discarded' THEN 'DECLINED'::"SuggestionStatus"
                     ELSE 'PENDING'::"SuggestionStatus"
                   END,
          "updatedAt" = COALESCE((parsed->>'updatedAt')::timestamptz, r."createdAt"),
          "legacyAuditJson" = CASE WHEN parsed ? 'auditTrail' THEN (parsed->'auditTrail')::text ELSE NULL END
        WHERE id = r.id;
      END IF;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Link legacy rows to their submitter where the recorded email matches a user.
UPDATE "Suggestion" s
SET "submittedByUserId" = u.id
FROM "User" u
WHERE s."userEmail" IS NOT NULL
  AND s."submittedByUserId" IS NULL
  AND lower(u.email) = lower(s."userEmail");
