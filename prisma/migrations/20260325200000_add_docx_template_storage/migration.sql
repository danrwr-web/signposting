-- AlterColumn: make contentHtml optional
ALTER TABLE "DocumentTemplate" ALTER COLUMN "contentHtml" DROP NOT NULL;

-- AddColumn: raw .docx file bytes
ALTER TABLE "DocumentTemplate" ADD COLUMN "templateDocx" BYTEA;

-- AddColumn: original upload filename
ALTER TABLE "DocumentTemplate" ADD COLUMN "fileName" TEXT;
