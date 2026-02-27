-- AlterTable: add multi-category learning assignments to DailyDoseCard
ALTER TABLE "DailyDoseCard" ADD COLUMN "learningAssignments" JSONB;
