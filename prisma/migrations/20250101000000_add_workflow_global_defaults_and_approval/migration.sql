-- AlterTable
ALTER TABLE "WorkflowTemplate" ADD COLUMN "sourceTemplateId" TEXT;
ALTER TABLE "WorkflowTemplate" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "WorkflowTemplate" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "WorkflowTemplate" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "WorkflowTemplate" ADD COLUMN "lastEditedBy" TEXT;
ALTER TABLE "WorkflowTemplate" ADD COLUMN "lastEditedAt" TIMESTAMP(3);

-- Note: workflowsEnabled flag removed - workflow guidance is now controlled via feature flags (workflow_guidance feature)

-- AddForeignKey
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "WorkflowTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_lastEditedBy_fkey" FOREIGN KEY ("lastEditedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

