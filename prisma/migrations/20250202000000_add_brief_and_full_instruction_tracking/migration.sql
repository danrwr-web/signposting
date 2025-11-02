-- AddBriefAndFullInstructionTracking
-- Add fields to track both brief and full instructions in SymptomHistory
ALTER TABLE "SymptomHistory" ADD COLUMN IF NOT EXISTS "previousBriefInstruction" TEXT;

ALTER TABLE "SymptomHistory" ADD COLUMN IF NOT EXISTS "newBriefInstruction" TEXT;

ALTER TABLE "SymptomHistory" ADD COLUMN IF NOT EXISTS "previousInstructionsHtml" TEXT;

ALTER TABLE "SymptomHistory" ADD COLUMN IF NOT EXISTS "newInstructionsHtml" TEXT;

