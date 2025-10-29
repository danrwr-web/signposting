-- AlterTable: Add clinical governance fields to Surgery
ALTER TABLE "Surgery" ADD COLUMN IF NOT EXISTS "requiresClinicalReview" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Surgery" ADD COLUMN IF NOT EXISTS "lastClinicalReviewAt" TIMESTAMP(3);
ALTER TABLE "Surgery" ADD COLUMN IF NOT EXISTS "lastClinicalReviewerId" TEXT;

-- AddForeignKey for clinical reviewer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Surgery_lastClinicalReviewerId_fkey'
  ) THEN
    ALTER TABLE "Surgery" ADD CONSTRAINT "Surgery_lastClinicalReviewerId_fkey" 
      FOREIGN KEY ("lastClinicalReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateEnum: SymptomReviewState
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SymptomReviewState') THEN
    CREATE TYPE "SymptomReviewState" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUIRED');
  END IF;
END $$;

-- CreateTable: SymptomReviewStatus
CREATE TABLE IF NOT EXISTS "SymptomReviewStatus" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "symptomId" TEXT NOT NULL,
    "ageGroup" TEXT,
    "status" "SymptomReviewState" NOT NULL DEFAULT 'PENDING',
    "lastReviewedAt" TIMESTAMP(3),
    "lastReviewedById" TEXT,

    CONSTRAINT "SymptomReviewStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SymptomReviewStatus_surgeryId_idx" ON "SymptomReviewStatus"("surgeryId");
CREATE INDEX IF NOT EXISTS "SymptomReviewStatus_surgeryId_status_idx" ON "SymptomReviewStatus"("surgeryId", "status");

-- CreateUniqueConstraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'SymptomReviewStatus_surgeryId_symptomId_ageGroup_key'
  ) THEN
    ALTER TABLE "SymptomReviewStatus" ADD CONSTRAINT "SymptomReviewStatus_surgeryId_symptomId_ageGroup_key" 
      UNIQUE ("surgeryId", "symptomId", "ageGroup");
  END IF;
END $$;

-- AddForeignKey for SymptomReviewStatus -> Surgery
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'SymptomReviewStatus_surgeryId_fkey'
  ) THEN
    ALTER TABLE "SymptomReviewStatus" ADD CONSTRAINT "SymptomReviewStatus_surgeryId_fkey" 
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey for SymptomReviewStatus -> User (reviewer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'SymptomReviewStatus_lastReviewedById_fkey'
  ) THEN
    ALTER TABLE "SymptomReviewStatus" ADD CONSTRAINT "SymptomReviewStatus_lastReviewedById_fkey" 
      FOREIGN KEY ("lastReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

