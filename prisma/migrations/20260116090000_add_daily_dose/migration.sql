-- AlterTable
ALTER TABLE "Surgery" ADD COLUMN "analyticsGuardrailMinN" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "DailyDoseProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyDoseProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDoseTopic" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT,
    "name" TEXT NOT NULL,
    "roleScope" JSONB NOT NULL,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyDoseTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDoseCard" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT,
    "title" TEXT NOT NULL,
    "roleScope" JSONB NOT NULL,
    "topicId" TEXT NOT NULL,
    "contentBlocks" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reviewByDate" TIMESTAMP(3),
    "tags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyDoseCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDoseCardVersion" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyDoseCardVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDoseSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cardIds" JSONB NOT NULL,
    "cardResults" JSONB,
    "questionsAttempted" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyDoseSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDoseUserCardState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 1,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "correctStreak" INTEGER NOT NULL DEFAULT 0,
    "incorrectStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyDoseUserCardState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDoseFlaggedContent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "freeText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyDoseFlaggedContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyDoseProfile_userId_surgeryId_key" ON "DailyDoseProfile"("userId", "surgeryId");

-- CreateIndex
CREATE INDEX "DailyDoseProfile_surgeryId_idx" ON "DailyDoseProfile"("surgeryId");

-- CreateIndex
CREATE INDEX "DailyDoseTopic_surgeryId_idx" ON "DailyDoseTopic"("surgeryId");

-- CreateIndex
CREATE INDEX "DailyDoseTopic_isActive_idx" ON "DailyDoseTopic"("isActive");

-- CreateIndex
CREATE INDEX "DailyDoseCard_topicId_idx" ON "DailyDoseCard"("topicId");

-- CreateIndex
CREATE INDEX "DailyDoseCard_surgeryId_idx" ON "DailyDoseCard"("surgeryId");

-- CreateIndex
CREATE INDEX "DailyDoseCard_status_idx" ON "DailyDoseCard"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DailyDoseCardVersion_cardId_version_key" ON "DailyDoseCardVersion"("cardId", "version");

-- CreateIndex
CREATE INDEX "DailyDoseCardVersion_cardId_idx" ON "DailyDoseCardVersion"("cardId");

-- CreateIndex
CREATE INDEX "DailyDoseSession_userId_sessionDate_idx" ON "DailyDoseSession"("userId", "sessionDate");

-- CreateIndex
CREATE INDEX "DailyDoseSession_surgeryId_completedAt_idx" ON "DailyDoseSession"("surgeryId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyDoseUserCardState_userId_cardId_key" ON "DailyDoseUserCardState"("userId", "cardId");

-- CreateIndex
CREATE INDEX "DailyDoseUserCardState_userId_dueAt_idx" ON "DailyDoseUserCardState"("userId", "dueAt");

-- CreateIndex
CREATE INDEX "DailyDoseUserCardState_surgeryId_idx" ON "DailyDoseUserCardState"("surgeryId");

-- CreateIndex
CREATE INDEX "DailyDoseFlaggedContent_surgeryId_idx" ON "DailyDoseFlaggedContent"("surgeryId");

-- CreateIndex
CREATE INDEX "DailyDoseFlaggedContent_status_idx" ON "DailyDoseFlaggedContent"("status");

-- AddForeignKey
ALTER TABLE "DailyDoseProfile" ADD CONSTRAINT "DailyDoseProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseProfile" ADD CONSTRAINT "DailyDoseProfile_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseTopic" ADD CONSTRAINT "DailyDoseTopic_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseCard" ADD CONSTRAINT "DailyDoseCard_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "DailyDoseTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseCard" ADD CONSTRAINT "DailyDoseCard_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseCard" ADD CONSTRAINT "DailyDoseCard_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseCard" ADD CONSTRAINT "DailyDoseCard_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseCardVersion" ADD CONSTRAINT "DailyDoseCardVersion_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "DailyDoseCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseCardVersion" ADD CONSTRAINT "DailyDoseCardVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseSession" ADD CONSTRAINT "DailyDoseSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseSession" ADD CONSTRAINT "DailyDoseSession_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseUserCardState" ADD CONSTRAINT "DailyDoseUserCardState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseUserCardState" ADD CONSTRAINT "DailyDoseUserCardState_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "DailyDoseCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseUserCardState" ADD CONSTRAINT "DailyDoseUserCardState_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseFlaggedContent" ADD CONSTRAINT "DailyDoseFlaggedContent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseFlaggedContent" ADD CONSTRAINT "DailyDoseFlaggedContent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "DailyDoseCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseFlaggedContent" ADD CONSTRAINT "DailyDoseFlaggedContent_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseFlaggedContent" ADD CONSTRAINT "DailyDoseFlaggedContent_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
