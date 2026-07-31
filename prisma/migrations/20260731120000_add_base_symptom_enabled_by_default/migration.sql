-- Opt-in base symptoms: when false, surgeries must explicitly enable
-- ("adopt") the symptom before it appears in their library. Existing
-- symptoms keep today's behaviour (enabled unless a status row disables).
ALTER TABLE "BaseSymptom" ADD COLUMN IF NOT EXISTS "enabledByDefault" BOOLEAN NOT NULL DEFAULT true;
