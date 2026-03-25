-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('Proposal', 'SaasAgreement', 'Dpa', 'HostingOverview', 'IgSecurityPack');

-- CreateTable
CREATE TABLE "ContractVariant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "contractVariantId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "contentJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractVariant_name_key" ON "ContractVariant"("name");

-- CreateIndex
CREATE INDEX "DocumentTemplate_contractVariantId_idx" ON "DocumentTemplate"("contractVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_contractVariantId_documentType_key" ON "DocumentTemplate"("contractVariantId", "documentType");

-- RenameColumn (preserve existing data)
ALTER TABLE "SalesPipeline" RENAME COLUMN "contractVariant" TO "contractVariantLabel";

-- AddColumn
ALTER TABLE "SalesPipeline" ADD COLUMN "contractVariantId" TEXT;

-- CreateIndex
CREATE INDEX "SalesPipeline_contractVariantId_idx" ON "SalesPipeline"("contractVariantId");

-- AddForeignKey
ALTER TABLE "SalesPipeline" ADD CONSTRAINT "SalesPipeline_contractVariantId_fkey" FOREIGN KEY ("contractVariantId") REFERENCES "ContractVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_contractVariantId_fkey" FOREIGN KEY ("contractVariantId") REFERENCES "ContractVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
