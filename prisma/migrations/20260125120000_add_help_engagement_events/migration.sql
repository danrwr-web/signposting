-- Create HelpEngagementEvent table for tracking help panel usage
CREATE TABLE "HelpEngagementEvent" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT,
    "userEmail" TEXT,
    "event" TEXT NOT NULL,
    "linkTitle" TEXT,
    "linkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpEngagementEvent_pkey" PRIMARY KEY ("id")
);

-- Add indexes for efficient querying
CREATE INDEX "HelpEngagementEvent_surgeryId_createdAt_idx" ON "HelpEngagementEvent"("surgeryId", "createdAt");
CREATE INDEX "HelpEngagementEvent_event_createdAt_idx" ON "HelpEngagementEvent"("event", "createdAt");
CREATE INDEX "HelpEngagementEvent_userEmail_idx" ON "HelpEngagementEvent"("userEmail");

-- Add foreign key constraint
ALTER TABLE "HelpEngagementEvent" ADD CONSTRAINT "HelpEngagementEvent_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
