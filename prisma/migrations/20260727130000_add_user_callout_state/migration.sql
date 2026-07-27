-- Per-user seen/dismissed state for new-feature callouts, replacing
-- per-browser localStorage so announcements follow users across devices.

-- CreateTable
CREATE TABLE "UserCalloutState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calloutKey" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "UserCalloutState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCalloutState_userId_calloutKey_key" ON "UserCalloutState"("userId", "calloutKey");

-- AddForeignKey
ALTER TABLE "UserCalloutState" ADD CONSTRAINT "UserCalloutState_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
