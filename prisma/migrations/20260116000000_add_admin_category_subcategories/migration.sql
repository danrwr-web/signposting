-- AlterTable
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AdminCategory' AND column_name = 'parentId') THEN
        ALTER TABLE "AdminCategory" ADD COLUMN "parentId" TEXT;
    END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminCategory_surgeryId_parentId_orderIndex_idx" ON "AdminCategory"("surgeryId", "parentId", "orderIndex");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminCategory_parentId_fkey') THEN
        ALTER TABLE "AdminCategory" ADD CONSTRAINT "AdminCategory_parentId_fkey" 
        FOREIGN KEY ("parentId") REFERENCES "AdminCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
