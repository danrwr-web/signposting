-- AlterTable: Add parentCategoryId to AdminCategory for subcategory support
ALTER TABLE "AdminCategory"
ADD COLUMN IF NOT EXISTS "parentCategoryId" TEXT;

-- AddForeignKey
ALTER TABLE "AdminCategory"
ADD CONSTRAINT "AdminCategory_parentCategoryId_fkey"
FOREIGN KEY ("parentCategoryId")
REFERENCES "AdminCategory"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminCategory_surgeryId_parentCategoryId_idx" ON "AdminCategory"("surgeryId", "parentCategoryId");
