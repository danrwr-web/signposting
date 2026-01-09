-- CreateTable
CREATE TABLE "WorkflowNodeStyleDefaultSurgery" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "nodeType" "WorkflowNodeType" NOT NULL,
    "bgColor" TEXT,
    "textColor" TEXT,
    "borderColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowNodeStyleDefaultSurgery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowNodeStyleDefaultSurgery_surgeryId_nodeType_key" ON "WorkflowNodeStyleDefaultSurgery"("surgeryId", "nodeType");

-- CreateIndex
CREATE INDEX "WorkflowNodeStyleDefaultSurgery_surgeryId_idx" ON "WorkflowNodeStyleDefaultSurgery"("surgeryId");

-- AddForeignKey
ALTER TABLE "WorkflowNodeStyleDefaultSurgery" ADD CONSTRAINT "WorkflowNodeStyleDefaultSurgery_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

