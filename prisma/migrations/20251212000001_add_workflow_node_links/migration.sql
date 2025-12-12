-- CreateTable: WorkflowNodeLink
CREATE TABLE IF NOT EXISTS "WorkflowNodeLink" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowNodeLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowNodeLink_nodeId_idx" ON "WorkflowNodeLink"("nodeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowNodeLink_templateId_idx" ON "WorkflowNodeLink"("templateId");

-- AddForeignKey
ALTER TABLE "WorkflowNodeLink" ADD CONSTRAINT "WorkflowNodeLink_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "WorkflowNodeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNodeLink" ADD CONSTRAINT "WorkflowNodeLink_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate existing linkToTemplateId/linkLabel data to WorkflowNodeLink
-- Note: Using cuid() equivalent - if your database doesn't support gen_random_uuid(),
-- you may need to handle this migration differently or skip this step if no data exists yet
DO $$
DECLARE
    node_record RECORD;
BEGIN
    FOR node_record IN SELECT "id", "linkToTemplateId", "linkLabel" FROM "WorkflowNodeTemplate" WHERE "linkToTemplateId" IS NOT NULL
    LOOP
        INSERT INTO "WorkflowNodeLink" ("id", "nodeId", "templateId", "label", "sortOrder", "createdAt", "updatedAt")
        VALUES (
            CONCAT('clink_', SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 21))::TEXT,
            node_record."id",
            node_record."linkToTemplateId",
            COALESCE(node_record."linkLabel", 'Open linked workflow'),
            0,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );
    END LOOP;
END $$;

-- AlterTable: Remove old columns from WorkflowNodeTemplate
ALTER TABLE "WorkflowNodeTemplate" DROP COLUMN IF EXISTS "linkToTemplateId";
ALTER TABLE "WorkflowNodeTemplate" DROP COLUMN IF EXISTS "linkLabel";

