-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkflowNodeStyleDefault" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "nodeType" "WorkflowNodeType" NOT NULL,
    "bgColor" TEXT,
    "textColor" TEXT,
    "borderColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowNodeStyleDefault_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowNodeStyleDefault_templateId_nodeType_key" ON "WorkflowNodeStyleDefault"("templateId", "nodeType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowNodeStyleDefault_templateId_idx" ON "WorkflowNodeStyleDefault"("templateId");

-- AddForeignKey
ALTER TABLE "WorkflowNodeStyleDefault" ADD CONSTRAINT "WorkflowNodeStyleDefault_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

