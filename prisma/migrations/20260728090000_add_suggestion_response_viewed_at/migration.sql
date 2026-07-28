-- Track when the submitter first viewed a response so the UI can badge unread responses.
ALTER TABLE "Suggestion" ADD COLUMN "responseViewedAt" TIMESTAMP(3);
