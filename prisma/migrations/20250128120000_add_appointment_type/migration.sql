-- CreateTable
CREATE TABLE "AppointmentType" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT,
    "name" TEXT NOT NULL,
    "staffType" TEXT,
    "durationMins" INTEGER,
    "colour" TEXT,
    "notes" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastEditedBy" TEXT,
    "lastEditedAt" TIMESTAMP(3),

    CONSTRAINT "AppointmentType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentType_surgeryId_idx" ON "AppointmentType"("surgeryId");

-- AddForeignKey
ALTER TABLE "AppointmentType" ADD CONSTRAINT "AppointmentType_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

