-- Convert legacy "blank-means-inherit" override prose values to NULL so that
-- the new tri-state read semantics (NULL = inherit, "" = explicit blank,
-- string = override) preserve existing behaviour for rows authored before
-- the change. Targets only fields the user can clear; structurally-global
-- fields (name, ageGroup, linkToPage) are out of scope.

UPDATE "SurgerySymptomOverride"
SET "briefInstruction" = NULL
WHERE "briefInstruction" IS NOT NULL AND TRIM("briefInstruction") = '';

UPDATE "SurgerySymptomOverride"
SET "instructions" = NULL
WHERE "instructions" IS NOT NULL AND TRIM("instructions") = '';

UPDATE "SurgerySymptomOverride"
SET "instructionsHtml" = NULL
WHERE "instructionsHtml" IS NOT NULL AND TRIM("instructionsHtml") = '';

UPDATE "SurgerySymptomOverride"
SET "instructionsJson" = NULL
WHERE "instructionsJson" IS NOT NULL AND TRIM("instructionsJson") = '';

UPDATE "SurgerySymptomOverride"
SET "highlightedText" = NULL
WHERE "highlightedText" IS NOT NULL AND TRIM("highlightedText") = '';
