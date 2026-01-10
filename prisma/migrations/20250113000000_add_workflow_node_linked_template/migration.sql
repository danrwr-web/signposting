-- AlterTable
ALTER TABLE "WorkflowNodeTemplate" ADD COLUMN     "linkToTemplateId" TEXT,
ADD COLUMN     "linkLabel" TEXT;

-- AddForeignKey
ALTER TABLE "WorkflowNodeTemplate" ADD CONSTRAINT "WorkflowNodeTemplate_linkToTemplateId_fkey" FOREIGN KEY ("linkToTemplateId") REFERENCES "WorkflowTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

