-- Add indexes to speed up symptom list queries and status lookups
CREATE INDEX IF NOT EXISTS "BaseSymptom_isDeleted_idx" ON "BaseSymptom" ("isDeleted");
CREATE INDEX IF NOT EXISTS "SurgeryCustomSymptom_surgeryId_isDeleted_idx" ON "SurgeryCustomSymptom" ("surgeryId", "isDeleted");
CREATE INDEX IF NOT EXISTS "SurgerySymptomStatus_surgeryId_isEnabled_idx" ON "SurgerySymptomStatus" ("surgeryId", "isEnabled");

