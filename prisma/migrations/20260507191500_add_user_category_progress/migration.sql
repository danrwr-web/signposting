-- CreateEnum
CREATE TYPE "LearningUnitLevel" AS ENUM ('INTRO', 'CORE', 'STRETCH');

-- CreateEnum
CREATE TYPE "MasteryState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SECURE');

-- AlterTable
ALTER TABLE "DailyDoseCard"
ADD COLUMN "unitLevel" "LearningUnitLevel" NOT NULL DEFAULT 'CORE';

-- CreateTable
CREATE TABLE "UserCategoryProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subsection" TEXT NOT NULL,
    "unitLevel" "LearningUnitLevel" NOT NULL DEFAULT 'CORE',
    "masteryState" "MasteryState" NOT NULL DEFAULT 'NOT_STARTED',
    "accuracyPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attemptedQuestions" INTEGER NOT NULL DEFAULT 0,
    "correctQuestions" INTEGER NOT NULL DEFAULT 0,
    "reinforcedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCategoryProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCategoryProgress_userId_surgeryId_categoryId_subsection_key"
ON "UserCategoryProgress"("userId", "surgeryId", "categoryId", "subsection");

-- CreateIndex
CREATE INDEX "UserCategoryProgress_userId_surgeryId_idx"
ON "UserCategoryProgress"("userId", "surgeryId");

-- CreateIndex
CREATE INDEX "UserCategoryProgress_categoryId_masteryState_idx"
ON "UserCategoryProgress"("categoryId", "masteryState");

-- AddForeignKey
ALTER TABLE "UserCategoryProgress"
ADD CONSTRAINT "UserCategoryProgress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCategoryProgress"
ADD CONSTRAINT "UserCategoryProgress_surgeryId_fkey"
FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCategoryProgress"
ADD CONSTRAINT "UserCategoryProgress_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "LearningCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
