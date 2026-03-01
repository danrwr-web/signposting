-- Add validationIssues column to DailyDoseCard
-- Stores AdminValidationIssue[] | null — cleared when editor saves a fix or overrides
ALTER TABLE "DailyDoseCard" ADD COLUMN "validationIssues" JSONB;
