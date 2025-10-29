-- Add cardSize and instructionSize fields to ImageIcon table
ALTER TABLE "ImageIcon" 
  ADD COLUMN IF NOT EXISTS "cardSize" TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS "instructionSize" TEXT NOT NULL DEFAULT 'medium';

