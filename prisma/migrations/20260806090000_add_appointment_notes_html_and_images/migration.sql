-- AlterTable: canonical rich-text notes for appointment types.
ALTER TABLE "AppointmentType" ADD COLUMN IF NOT EXISTS "notesHtml" TEXT;

-- CreateTable: AppointmentImage (inline images in appointment notes).
-- appointmentTypeId is null for images uploaded from the create modal before
-- the appointment exists; saving the appointment claims them.
CREATE TABLE IF NOT EXISTS "AppointmentImage" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "appointmentTypeId" TEXT,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentImage_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "AppointmentImage_surgeryId_idx" ON "AppointmentImage" ("surgeryId");
CREATE INDEX IF NOT EXISTS "AppointmentImage_appointmentTypeId_idx" ON "AppointmentImage" ("appointmentTypeId");
CREATE INDEX IF NOT EXISTS "AppointmentImage_createdByUserId_idx" ON "AppointmentImage" ("createdByUserId");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppointmentImage_surgeryId_fkey') THEN
    ALTER TABLE "AppointmentImage" ADD CONSTRAINT "AppointmentImage_surgeryId_fkey"
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppointmentImage_appointmentTypeId_fkey') THEN
    ALTER TABLE "AppointmentImage" ADD CONSTRAINT "AppointmentImage_appointmentTypeId_fkey"
      FOREIGN KEY ("appointmentTypeId") REFERENCES "AppointmentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppointmentImage_createdByUserId_fkey') THEN
    ALTER TABLE "AppointmentImage" ADD CONSTRAINT "AppointmentImage_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
