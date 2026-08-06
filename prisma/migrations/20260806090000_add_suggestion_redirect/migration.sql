-- Track suggestions a superuser has redirected to the practice's own admin queue,
-- keeping the original type for display to the submitter.
ALTER TABLE "Suggestion" ADD COLUMN "redirectedFromType" "SuggestionType";
ALTER TABLE "Suggestion" ADD COLUMN "redirectedAt" TIMESTAMP(3);
