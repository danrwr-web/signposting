-- AlterTable
ALTER TABLE "EngagementEvent" ADD COLUMN "ref" TEXT;

-- CreateIndex
CREATE INDEX "EngagementEvent_surgeryId_ref_idx" ON "EngagementEvent"("surgeryId", "ref");
