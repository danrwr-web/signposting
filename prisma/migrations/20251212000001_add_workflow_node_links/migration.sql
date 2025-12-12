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
INSERT INTO "WorkflowNodeLink" ("id", "nodeId", "templateId", "label", "sortOrder", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text as "id",
    "id" as "nodeId",
    "linkToTemplateId" as "templateId",
    COALESCE("linkLabel", 'Open linked workflow') as "label",
    0 as "sortOrder",
    CURRENT_TIMESTAMP as "createdAt",
    CURRENT_TIMESTAMP as "updatedAt"
FROM "WorkflowNodeTemplate"
WHERE "linkToTemplateId" IS NOT NULL;

-- AlterTable: Remove old columns from WorkflowNodeTemplate
ALTER TABLE "WorkflowNodeTemplate" DROP COLUMN IF EXISTS "linkToTemplateId";
ALTER TABLE "WorkflowNodeTemplate" DROP COLUMN IF EXISTS "linkLabel";

