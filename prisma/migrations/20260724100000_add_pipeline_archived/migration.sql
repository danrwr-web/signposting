-- AddColumn: archivedAt on SalesPipeline (reversible archive for entries that have gone quiet)
ALTER TABLE "SalesPipeline" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SalesPipeline_archivedAt_idx" ON "SalesPipeline"("archivedAt");
