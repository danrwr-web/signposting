# Running the Database Migration

If the automatic migration didn't run during deployment, you have two options:

## Option 1: Via Vercel CLI (Recommended)

If you have Vercel CLI installed locally:

```bash
vercel --prod
```

Or to run the migration directly:

```bash
vercel env pull .env.production
prisma migrate deploy
```

## Option 2: Via Neon Dashboard

1. Go to your Neon project dashboard
2. Click on "SQL Editor" or "Query"
3. Run the migration SQL directly:

-- Add enableImageIcons column to Surgery table
ALTER TABLE "Surgery" ADD COLUMN IF NOT EXISTS "enableImageIcons" BOOLEAN NOT NULL DEFAULT true;

-- Create ImageIcon table
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

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ImageIcon_phrase_key" ON "ImageIcon"("phrase");
CREATE INDEX IF NOT EXISTS "ImageIcon_phrase_idx" ON "ImageIcon"("phrase");

## Check if migration ran

You can verify if the migration already ran by checking your Neon database for:
- `enableImageIcons` column in the `Surgery` table
- `ImageIcon` table exists
