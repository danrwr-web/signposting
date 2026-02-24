-- CreateTable
CREATE TABLE "DailyDoseTheme" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyDoseTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDoseUnit" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT NOT NULL,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyDoseUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDoseUnitCard" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "ordering" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyDoseUnitCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserUnitProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "sessionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "lastSessionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserUnitProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyDoseTheme_surgeryId_idx" ON "DailyDoseTheme"("surgeryId");

-- CreateIndex
CREATE INDEX "DailyDoseTheme_isActive_idx" ON "DailyDoseTheme"("isActive");

-- CreateIndex
CREATE INDEX "DailyDoseTheme_ordering_idx" ON "DailyDoseTheme"("ordering");

-- CreateIndex
CREATE INDEX "DailyDoseUnit_themeId_idx" ON "DailyDoseUnit"("themeId");

-- CreateIndex
CREATE INDEX "DailyDoseUnit_level_idx" ON "DailyDoseUnit"("level");

-- CreateIndex
CREATE INDEX "DailyDoseUnit_themeId_ordering_idx" ON "DailyDoseUnit"("themeId", "ordering");

-- CreateIndex
CREATE UNIQUE INDEX "DailyDoseUnitCard_unitId_cardId_key" ON "DailyDoseUnitCard"("unitId", "cardId");

-- CreateIndex
CREATE INDEX "DailyDoseUnitCard_unitId_ordering_idx" ON "DailyDoseUnitCard"("unitId", "ordering");

-- CreateIndex
CREATE INDEX "DailyDoseUnitCard_cardId_idx" ON "DailyDoseUnitCard"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "UserUnitProgress_userId_unitId_key" ON "UserUnitProgress"("userId", "unitId");

-- CreateIndex
CREATE INDEX "UserUnitProgress_userId_surgeryId_idx" ON "UserUnitProgress"("userId", "surgeryId");

-- CreateIndex
CREATE INDEX "UserUnitProgress_surgeryId_idx" ON "UserUnitProgress"("surgeryId");

-- CreateIndex
CREATE INDEX "UserUnitProgress_unitId_idx" ON "UserUnitProgress"("unitId");

-- AddForeignKey
ALTER TABLE "DailyDoseTheme" ADD CONSTRAINT "DailyDoseTheme_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseUnit" ADD CONSTRAINT "DailyDoseUnit_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "DailyDoseTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseUnitCard" ADD CONSTRAINT "DailyDoseUnitCard_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "DailyDoseUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDoseUnitCard" ADD CONSTRAINT "DailyDoseUnitCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "DailyDoseCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUnitProgress" ADD CONSTRAINT "UserUnitProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUnitProgress" ADD CONSTRAINT "UserUnitProgress_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "DailyDoseUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUnitProgress" ADD CONSTRAINT "UserUnitProgress_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
