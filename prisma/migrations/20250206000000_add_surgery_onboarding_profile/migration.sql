-- CreateTable
CREATE TABLE "SurgeryOnboardingProfile" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "profileJson" JSONB NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurgeryOnboardingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurgeryOnboardingProfile_surgeryId_key" ON "SurgeryOnboardingProfile"("surgeryId");

-- CreateIndex
CREATE INDEX "SurgeryOnboardingProfile_surgeryId_idx" ON "SurgeryOnboardingProfile"("surgeryId");

-- AddForeignKey
ALTER TABLE "SurgeryOnboardingProfile" ADD CONSTRAINT "SurgeryOnboardingProfile_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

