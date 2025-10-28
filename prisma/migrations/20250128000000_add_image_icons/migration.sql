-- AlterTable
ALTER TABLE "Surgery" ADD COLUMN IF NOT EXISTS "enableImageIcons" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ImageIcon" (
    "id" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "alt" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageIcon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ImageIcon_phrase_key" ON "ImageIcon"("phrase");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImageIcon_phrase_idx" ON "ImageIcon"("phrase");
