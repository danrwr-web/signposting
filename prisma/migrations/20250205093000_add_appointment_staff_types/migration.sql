-- CreateTable
CREATE TABLE "AppointmentStaffType" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT NOT NULL,
    "defaultColour" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppointmentStaffType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentStaffType_surgeryId_normalizedLabel_key" ON "AppointmentStaffType"("surgeryId", "normalizedLabel");

-- CreateIndex
CREATE INDEX "AppointmentStaffType_surgeryId_orderIndex_idx" ON "AppointmentStaffType"("surgeryId", "orderIndex");

-- AddForeignKey
ALTER TABLE "AppointmentStaffType" ADD CONSTRAINT "AppointmentStaffType_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed built-in staff types
INSERT INTO "AppointmentStaffType" ("id", "surgeryId", "label", "normalizedLabel", "defaultColour", "orderIndex", "isBuiltIn", "isEnabled") VALUES
  (gen_random_uuid()::text, NULL, 'All', 'ALL', 'bg-nhs-yellow-tint', 0, true, true),
  (gen_random_uuid()::text, NULL, 'PN', 'PN', 'bg-nhs-green-tint', 1, true, true),
  (gen_random_uuid()::text, NULL, 'HCA', 'HCA', 'bg-nhs-red-tint', 2, true, true),
  (gen_random_uuid()::text, NULL, 'Dr', 'DR', 'bg-nhs-light-blue', 3, true, true)
ON CONFLICT DO NOTHING;
