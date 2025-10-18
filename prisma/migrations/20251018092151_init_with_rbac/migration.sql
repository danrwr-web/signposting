-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "globalRole" TEXT NOT NULL DEFAULT 'USER',
    "defaultSurgeryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_defaultSurgeryId_fkey" FOREIGN KEY ("defaultSurgeryId") REFERENCES "Surgery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSurgery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STANDARD',
    CONSTRAINT "UserSurgery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserSurgery_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Surgery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "adminEmail" TEXT,
    "adminPassHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "enableDefaultHighRisk" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "BaseSymptom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "briefInstruction" TEXT,
    "highlightedText" TEXT,
    "instructions" TEXT,
    "linkToPage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SurgerySymptomOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surgeryId" TEXT NOT NULL,
    "baseSymptomId" TEXT NOT NULL,
    "name" TEXT,
    "ageGroup" TEXT,
    "briefInstruction" TEXT,
    "highlightedText" TEXT,
    "instructions" TEXT,
    "linkToPage" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SurgerySymptomOverride_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SurgerySymptomOverride_baseSymptomId_fkey" FOREIGN KEY ("baseSymptomId") REFERENCES "BaseSymptom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SurgeryCustomSymptom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surgeryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "briefInstruction" TEXT,
    "highlightedText" TEXT,
    "instructions" TEXT,
    "linkToPage" TEXT,
    CONSTRAINT "SurgeryCustomSymptom_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surgeryId" TEXT,
    "baseId" TEXT,
    "symptom" TEXT NOT NULL,
    "userEmail" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Suggestion_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EngagementEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surgeryId" TEXT,
    "baseId" TEXT NOT NULL,
    "userEmail" TEXT,
    "event" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EngagementEvent_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EngagementEvent_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "BaseSymptom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HighlightRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surgeryId" TEXT,
    "phrase" TEXT NOT NULL,
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "bgColor" TEXT NOT NULL DEFAULT '#6A0DAD',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HighlightRule_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HighRiskLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surgeryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "symptomSlug" TEXT,
    "symptomId" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "HighRiskLink_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DefaultHighRiskButtonConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surgeryId" TEXT NOT NULL,
    "buttonKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "symptomSlug" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DefaultHighRiskButtonConfig_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSurgery_userId_surgeryId_key" ON "UserSurgery"("userId", "surgeryId");

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
