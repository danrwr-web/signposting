-- AddColumn: Invoice tracking dates on SalesPipeline
ALTER TABLE "SalesPipeline" ADD COLUMN "invoiceGeneratedAt" TIMESTAMP(3);
ALTER TABLE "SalesPipeline" ADD COLUMN "invoicePaidAt" TIMESTAMP(3);

-- AlterEnum: Add SetupGuide to DocumentType
ALTER TYPE "DocumentType" ADD VALUE 'SetupGuide';

-- AlterTable: Make contractVariantId nullable on DocumentTemplate
-- Drop existing foreign key to recreate it with NULL allowed
ALTER TABLE "DocumentTemplate" DROP CONSTRAINT "DocumentTemplate_contractVariantId_fkey";

ALTER TABLE "DocumentTemplate" ALTER COLUMN "contractVariantId" DROP NOT NULL;

ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_contractVariantId_fkey" FOREIGN KEY ("contractVariantId") REFERENCES "ContractVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
