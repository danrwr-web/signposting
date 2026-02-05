-- AlterTable
ALTER TABLE "DailyDoseCard" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "DailyDoseCard_isActive_idx" ON "DailyDoseCard"("isActive");
