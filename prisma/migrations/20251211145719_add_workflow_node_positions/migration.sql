-- AlterTable: Add positionX and positionY to WorkflowNodeTemplate
ALTER TABLE "WorkflowNodeTemplate" ADD COLUMN IF NOT EXISTS "positionX" INTEGER;
ALTER TABLE "WorkflowNodeTemplate" ADD COLUMN IF NOT EXISTS "positionY" INTEGER;

