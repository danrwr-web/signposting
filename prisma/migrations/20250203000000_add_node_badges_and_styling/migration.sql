-- AlterTable: Add badges and style fields to WorkflowNodeTemplate
ALTER TABLE "WorkflowNodeTemplate" ADD COLUMN IF NOT EXISTS "badges" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "WorkflowNodeTemplate" ADD COLUMN IF NOT EXISTS "style" JSONB;

-- AlterEnum: Add PANEL to WorkflowNodeType enum
-- Note: PostgreSQL doesn't support ALTER TYPE ADD VALUE in a transaction, so we use a workaround
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PANEL' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'WorkflowNodeType')) THEN
        ALTER TYPE "WorkflowNodeType" ADD VALUE 'PANEL';
    END IF;
END $$;
