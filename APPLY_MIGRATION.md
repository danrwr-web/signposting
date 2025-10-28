# Database Migration Instructions

You need to apply the latest database migration to add the `isEnabled` and `surgeryId` fields to the `ImageIcon` table.

## Option 1: Using Neon Console (Recommended)

1. Go to your Neon database console
2. Open the SQL Editor
3. Copy and paste the following SQL:

```sql
ALTER TABLE "ImageIcon" 
  ADD COLUMN IF NOT EXISTS "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "surgeryId" TEXT;

ALTER TABLE "ImageIcon" 
  DROP CONSTRAINT IF EXISTS "ImageIcon_phrase_key";

ALTER TABLE "ImageIcon" 
  ADD CONSTRAINT "ImageIcon_phrase_surgeryId_key" UNIQUE ("phrase", "surgeryId");

CREATE INDEX IF NOT EXISTS "ImageIcon_surgeryId_idx" ON "ImageIcon"("surgeryId");
```

4. Run the SQL

## Option 2: Using Prisma Migrate (Local Development)

If you're running locally with the Neon database:

```bash
npm run db:migrate:deploy
```

## After Migration

Once the migration is applied, the 503 error on `/api/image-icons` should be resolved and you'll be able to upload and manage image icons.
