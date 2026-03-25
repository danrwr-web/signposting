-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('Enquiry', 'DemoBooked', 'DemoCompleted', 'ProposalSent', 'DocumentsSent', 'Contracted', 'OnHold', 'Lost');

-- CreateTable
CREATE TABLE "SalesPipeline" (
    "id" TEXT NOT NULL,
    "practiceName" TEXT NOT NULL,
    "townCity" TEXT,
    "pcnName" TEXT,
    "listSize" INTEGER,
    "estimatedFeeGbp" DOUBLE PRECISION,
    "contactName" TEXT,
    "contactRole" TEXT,
    "contactEmail" TEXT,
    "status" "PipelineStatus" NOT NULL DEFAULT 'Enquiry',
    "dateEnquiry" TIMESTAMP(3),
    "dateDemoBooked" TIMESTAMP(3),
    "dateDemoCompleted" TIMESTAMP(3),
    "dateProposalSent" TIMESTAMP(3),
    "dateOnboardingFormSent" TIMESTAMP(3),
    "dateSaasAgreementSent" TIMESTAMP(3),
    "dateSaasAgreementSigned" TIMESTAMP(3),
    "dateDpaSent" TIMESTAMP(3),
    "dateDpaSigned" TIMESTAMP(3),
    "dateContractStart" TIMESTAMP(3),
    "freeTrial" BOOLEAN NOT NULL DEFAULT false,
    "trialEndDate" TIMESTAMP(3),
    "annualValueGbp" DOUBLE PRECISION,
    "contractVariant" TEXT,
    "notes" TEXT,
    "linkedSurgeryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPipeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesPipeline_linkedSurgeryId_key" ON "SalesPipeline"("linkedSurgeryId");

-- CreateIndex
CREATE INDEX "SalesPipeline_status_idx" ON "SalesPipeline"("status");

-- CreateIndex
CREATE INDEX "SalesPipeline_linkedSurgeryId_idx" ON "SalesPipeline"("linkedSurgeryId");

-- AddForeignKey
ALTER TABLE "SalesPipeline" ADD CONSTRAINT "SalesPipeline_linkedSurgeryId_fkey" FOREIGN KEY ("linkedSurgeryId") REFERENCES "Surgery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
