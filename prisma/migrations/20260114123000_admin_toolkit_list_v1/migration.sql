-- Admin Toolkit LIST v1
-- Rename AdminListColumn.type -> fieldType

ALTER TABLE "AdminListColumn" RENAME COLUMN "type" TO "fieldType";

-- Ensure default remains TEXT
ALTER TABLE "AdminListColumn" ALTER COLUMN "fieldType" SET DEFAULT 'TEXT';

