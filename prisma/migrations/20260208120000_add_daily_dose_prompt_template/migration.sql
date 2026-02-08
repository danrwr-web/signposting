-- CreateTable
CREATE TABLE "DailyDosePromptTemplate" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,

    CONSTRAINT "DailyDosePromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyDosePromptTemplate_role_key" ON "DailyDosePromptTemplate"("role");

-- AddForeignKey
ALTER TABLE "DailyDosePromptTemplate" ADD CONSTRAINT "DailyDosePromptTemplate_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
