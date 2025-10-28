# Apply Image Icon Migration

The `ImageIcon` table needs two new columns: `isEnabled` and `surgeryId`.

## Run this SQL in your Neon database console:

```sql
-- Add isEnabled and surgeryId fields to ImageIcon table
ALTER TABLE "ImageIcon" 
  ADD COLUMN IF NOT EXISTS "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "surgeryId" TEXT;

-- Drop the old unique constraint and add a new one that includes surgeryId
ALTER TABLE "ImageIcon" 
  DROP CONSTRAINT IF EXISTS "ImageIcon_phrase_key";

-- Create new composite unique constraint on (phrase, surgeryId)
ALTER TABLE "ImageIcon" 
  ADD CONSTRAINT "ImageIcon_phrase_surgeryId_key" UNIQUE ("phrase", "surgeryId");

-- Create index on surgeryId for faster lookups
CREATE INDEX IF NOT EXISTS "ImageIcon_surgeryId_idx" ON "ImageIcon"("surgeryId");
```

## After running the migration:

1. Wait for Vercel to redeploy (automatic after git push)
2. Try adding an image icon again
3. The 503 error should be resolved

