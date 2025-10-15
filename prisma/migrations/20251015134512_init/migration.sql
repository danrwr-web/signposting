-- CreateTable
CREATE TABLE "Surgery" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "adminEmail" TEXT,
    "adminPassHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enableDefaultHighRisk" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Surgery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaseSymptom" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "briefInstruction" TEXT,
    "highlightedText" TEXT,
    "instructions" TEXT,
    "linkToPage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaseSymptom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurgerySymptomOverride" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "baseSymptomId" TEXT NOT NULL,
    "name" TEXT,
    "ageGroup" TEXT,
    "briefInstruction" TEXT,
    "highlightedText" TEXT,
    "instructions" TEXT,
    "linkToPage" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SurgerySymptomOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurgeryCustomSymptom" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "briefInstruction" TEXT,
    "highlightedText" TEXT,
    "instructions" TEXT,
    "linkToPage" TEXT,

    CONSTRAINT "SurgeryCustomSymptom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT,
    "baseId" TEXT,
    "symptom" TEXT NOT NULL,
    "userEmail" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementEvent" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT,
    "baseId" TEXT NOT NULL,
    "userEmail" TEXT,
    "event" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HighlightRule" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT,
    "phrase" TEXT NOT NULL,
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "bgColor" TEXT NOT NULL DEFAULT '#6A0DAD',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HighlightRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HighRiskLink" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "symptomSlug" TEXT,
    "symptomId" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HighRiskLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefaultHighRiskButtonConfig" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "buttonKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "symptomSlug" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DefaultHighRiskButtonConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Surgery_name_key" ON "Surgery"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Surgery_slug_key" ON "Surgery"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Surgery_adminEmail_key" ON "Surgery"("adminEmail");

-- CreateIndex
CREATE UNIQUE INDEX "BaseSymptom_slug_key" ON "BaseSymptom"("slug");

-- CreateIndex
CREATE INDEX "BaseSymptom_name_idx" ON "BaseSymptom"("name");

-- CreateIndex
CREATE INDEX "BaseSymptom_slug_idx" ON "BaseSymptom"("slug");

-- CreateIndex
CREATE INDEX "BaseSymptom_ageGroup_idx" ON "BaseSymptom"("ageGroup");

-- CreateIndex
CREATE INDEX "SurgerySymptomOverride_surgeryId_baseSymptomId_idx" ON "SurgerySymptomOverride"("surgeryId", "baseSymptomId");

-- CreateIndex
CREATE UNIQUE INDEX "SurgerySymptomOverride_surgeryId_baseSymptomId_key" ON "SurgerySymptomOverride"("surgeryId", "baseSymptomId");

-- CreateIndex
CREATE INDEX "SurgeryCustomSymptom_surgeryId_slug_idx" ON "SurgeryCustomSymptom"("surgeryId", "slug");

-- CreateIndex
CREATE INDEX "SurgeryCustomSymptom_surgeryId_ageGroup_idx" ON "SurgeryCustomSymptom"("surgeryId", "ageGroup");

-- CreateIndex
CREATE UNIQUE INDEX "SurgeryCustomSymptom_surgeryId_slug_key" ON "SurgeryCustomSymptom"("surgeryId", "slug");

-- CreateIndex
CREATE INDEX "HighlightRule_surgeryId_phrase_idx" ON "HighlightRule"("surgeryId", "phrase");

-- CreateIndex
CREATE UNIQUE INDEX "HighlightRule_surgeryId_phrase_key" ON "HighlightRule"("surgeryId", "phrase");

-- CreateIndex
CREATE INDEX "HighRiskLink_surgeryId_orderIndex_idx" ON "HighRiskLink"("surgeryId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "HighRiskLink_surgeryId_label_key" ON "HighRiskLink"("surgeryId", "label");

-- CreateIndex
CREATE INDEX "DefaultHighRiskButtonConfig_surgeryId_buttonKey_idx" ON "DefaultHighRiskButtonConfig"("surgeryId", "buttonKey");

-- CreateIndex
CREATE UNIQUE INDEX "DefaultHighRiskButtonConfig_surgeryId_buttonKey_key" ON "DefaultHighRiskButtonConfig"("surgeryId", "buttonKey");

-- AddForeignKey
ALTER TABLE "SurgerySymptomOverride" ADD CONSTRAINT "SurgerySymptomOverride_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgerySymptomOverride" ADD CONSTRAINT "SurgerySymptomOverride_baseSymptomId_fkey" FOREIGN KEY ("baseSymptomId") REFERENCES "BaseSymptom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgeryCustomSymptom" ADD CONSTRAINT "SurgeryCustomSymptom_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "BaseSymptom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HighlightRule" ADD CONSTRAINT "HighlightRule_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HighRiskLink" ADD CONSTRAINT "HighRiskLink_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefaultHighRiskButtonConfig" ADD CONSTRAINT "DefaultHighRiskButtonConfig_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
