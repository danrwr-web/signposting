-- CreateIndex
-- Serves the cross-surgery Engagement Analytics overview, which filters on
-- event + createdAt with no surgeryId, so the existing (surgeryId, …)
-- composites cannot be used.
CREATE INDEX "EngagementEvent_event_createdAt_idx" ON "EngagementEvent"("event", "createdAt");
