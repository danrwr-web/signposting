-- CreateTable
CREATE TABLE "DailyDoseTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "DailyDoseTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyDoseTag_name_key" ON "DailyDoseTag"("name");

-- CreateIndex
CREATE INDEX "DailyDoseTag_name_idx" ON "DailyDoseTag"("name");

-- AddForeignKey
ALTER TABLE "DailyDoseTag" ADD CONSTRAINT "DailyDoseTag_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
