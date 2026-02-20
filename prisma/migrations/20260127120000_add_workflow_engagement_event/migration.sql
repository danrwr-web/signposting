-- CreateTable
CREATE TABLE "WorkflowEngagementEvent" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" TEXT NOT NULL DEFAULT 'view_workflow',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEngagementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowEngagementEvent_surgeryId_createdAt_idx" ON "WorkflowEngagementEvent"("surgeryId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowEngagementEvent_templateId_idx" ON "WorkflowEngagementEvent"("templateId");

-- CreateIndex
CREATE INDEX "WorkflowEngagementEvent_userId_idx" ON "WorkflowEngagementEvent"("userId");

-- AddForeignKey
ALTER TABLE "WorkflowEngagementEvent" ADD CONSTRAINT "WorkflowEngagementEvent_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEngagementEvent" ADD CONSTRAINT "WorkflowEngagementEvent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEngagementEvent" ADD CONSTRAINT "WorkflowEngagementEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
