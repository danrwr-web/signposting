-- CreateEnum
CREATE TYPE "SurgeryType" AS ENUM ('LIVE', 'TEST', 'GLOBAL_DEFAULT');

-- AlterTable
ALTER TABLE "Surgery" ADD COLUMN "surgeryType" "SurgeryType" NOT NULL DEFAULT 'LIVE';

-- Backfill: the global default/template surgery is matched by id, slug, or name
-- (mirrors the lookup in src/server/adminToolkit/seedGlobalDefaults.ts)
UPDATE "Surgery" SET "surgeryType" = 'GLOBAL_DEFAULT'
WHERE "id" = 'global-default-buttons'
   OR "slug" = 'global-default-buttons'
   OR "name" = 'global-default-buttons';
