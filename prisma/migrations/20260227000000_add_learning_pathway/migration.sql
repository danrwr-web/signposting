-- CreateTable: LearningCategory
CREATE TABLE "LearningCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subsections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningCategory_name_key" ON "LearningCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LearningCategory_slug_key" ON "LearningCategory"("slug");

-- CreateIndex
CREATE INDEX "LearningCategory_isActive_idx" ON "LearningCategory"("isActive");

-- CreateIndex
CREATE INDEX "LearningCategory_ordering_idx" ON "LearningCategory"("ordering");

-- AlterTable: Add learning category fields to DailyDoseCard
ALTER TABLE "DailyDoseCard" ADD COLUMN "learningCategoryId" TEXT;
ALTER TABLE "DailyDoseCard" ADD COLUMN "learningSubsection" TEXT;

-- CreateIndex
CREATE INDEX "DailyDoseCard_learningCategoryId_idx" ON "DailyDoseCard"("learningCategoryId");

-- AddForeignKey
ALTER TABLE "DailyDoseCard" ADD CONSTRAINT "DailyDoseCard_learningCategoryId_fkey"
    FOREIGN KEY ("learningCategoryId") REFERENCES "LearningCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
