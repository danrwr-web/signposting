-- Add summary and entityType columns to AdminHistory for better audit display
ALTER TABLE "AdminHistory" ADD COLUMN "summary" TEXT;
ALTER TABLE "AdminHistory" ADD COLUMN "entityType" TEXT;

-- Add index for filtering by entityType
CREATE INDEX "AdminHistory_surgeryId_entityType_idx" ON "AdminHistory"("surgeryId", "entityType");

-- Create AdminToolkitEngagementEvent table for tracking item views
CREATE TABLE "AdminToolkitEngagementEvent" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "adminItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" TEXT NOT NULL DEFAULT 'view_item',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminToolkitEngagementEvent_pkey" PRIMARY KEY ("id")
);

-- Add indexes for efficient querying
CREATE INDEX "AdminToolkitEngagementEvent_surgeryId_createdAt_idx" ON "AdminToolkitEngagementEvent"("surgeryId", "createdAt");
CREATE INDEX "AdminToolkitEngagementEvent_adminItemId_idx" ON "AdminToolkitEngagementEvent"("adminItemId");
CREATE INDEX "AdminToolkitEngagementEvent_userId_idx" ON "AdminToolkitEngagementEvent"("userId");

-- Add foreign key constraints
ALTER TABLE "AdminToolkitEngagementEvent" ADD CONSTRAINT "AdminToolkitEngagementEvent_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminToolkitEngagementEvent" ADD CONSTRAINT "AdminToolkitEngagementEvent_adminItemId_fkey" FOREIGN KEY ("adminItemId") REFERENCES "AdminItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminToolkitEngagementEvent" ADD CONSTRAINT "AdminToolkitEngagementEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
