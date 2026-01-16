-- CreateTable: AdminQuickLink
CREATE TABLE IF NOT EXISTS "AdminQuickLink" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "adminItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "bgColor" TEXT,
    "textColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminQuickLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminQuickLink_surgeryId_orderIndex_idx" ON "AdminQuickLink" ("surgeryId", "orderIndex");

-- CreateIndex (unique constraint)
CREATE UNIQUE INDEX IF NOT EXISTS "AdminQuickLink_surgeryId_adminItemId_key" ON "AdminQuickLink" ("surgeryId", "adminItemId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminQuickLink_surgeryId_fkey') THEN
        ALTER TABLE "AdminQuickLink" ADD CONSTRAINT "AdminQuickLink_surgeryId_fkey" 
        FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminQuickLink_adminItemId_fkey') THEN
        ALTER TABLE "AdminQuickLink" ADD CONSTRAINT "AdminQuickLink_adminItemId_fkey" 
        FOREIGN KEY ("adminItemId") REFERENCES "AdminItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
