-- AlterTable: UserSurgery (add Admin Toolkit write flag)
ALTER TABLE "UserSurgery"
ADD COLUMN IF NOT EXISTS "adminToolkitWrite" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: AdminCategory
CREATE TABLE IF NOT EXISTS "AdminCategory" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminItem
CREATE TABLE IF NOT EXISTS "AdminItem" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "categoryId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentHtml" TEXT,
    "contentJson" JSONB,
    "warningLevel" TEXT,
    "ownerUserId" TEXT,
    "lastReviewedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminItemEditor
CREATE TABLE IF NOT EXISTS "AdminItemEditor" (
    "id" TEXT NOT NULL,
    "adminItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminItemEditor_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminListColumn
CREATE TABLE IF NOT EXISTS "AdminListColumn" (
    "id" TEXT NOT NULL,
    "adminItemId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminListColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminListRow
CREATE TABLE IF NOT EXISTS "AdminListRow" (
    "id" TEXT NOT NULL,
    "adminItemId" TEXT NOT NULL,
    "dataJson" JSONB NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminListRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminItemAttachment (links only in v1)
CREATE TABLE IF NOT EXISTS "AdminItemAttachment" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "adminItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminItemAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminPinnedPanel
CREATE TABLE IF NOT EXISTS "AdminPinnedPanel" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "taskBuddyText" TEXT,
    "postRouteText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminPinnedPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminDutyRotaEntry
CREATE TABLE IF NOT EXISTS "AdminDutyRotaEntry" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminDutyRotaEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminHistory
CREATE TABLE IF NOT EXISTS "AdminHistory" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "adminItemId" TEXT,
    "adminCategoryId" TEXT,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "diffJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminHistory_pkey" PRIMARY KEY ("id")
);

-- Indexes & unique constraints
CREATE INDEX IF NOT EXISTS "AdminCategory_surgeryId_orderIndex_idx" ON "AdminCategory" ("surgeryId", "orderIndex");
CREATE INDEX IF NOT EXISTS "AdminCategory_surgeryId_deletedAt_idx" ON "AdminCategory" ("surgeryId", "deletedAt");

CREATE INDEX IF NOT EXISTS "AdminItem_surgeryId_deletedAt_idx" ON "AdminItem" ("surgeryId", "deletedAt");
CREATE INDEX IF NOT EXISTS "AdminItem_surgeryId_categoryId_idx" ON "AdminItem" ("surgeryId", "categoryId");
CREATE INDEX IF NOT EXISTS "AdminItem_surgeryId_title_idx" ON "AdminItem" ("surgeryId", "title");

CREATE UNIQUE INDEX IF NOT EXISTS "AdminItemEditor_adminItemId_userId_key" ON "AdminItemEditor" ("adminItemId", "userId");
CREATE INDEX IF NOT EXISTS "AdminItemEditor_userId_idx" ON "AdminItemEditor" ("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "AdminListColumn_adminItemId_key_key" ON "AdminListColumn" ("adminItemId", "key");
CREATE INDEX IF NOT EXISTS "AdminListColumn_adminItemId_orderIndex_idx" ON "AdminListColumn" ("adminItemId", "orderIndex");

CREATE INDEX IF NOT EXISTS "AdminListRow_adminItemId_orderIndex_idx" ON "AdminListRow" ("adminItemId", "orderIndex");
CREATE INDEX IF NOT EXISTS "AdminListRow_adminItemId_deletedAt_idx" ON "AdminListRow" ("adminItemId", "deletedAt");

CREATE INDEX IF NOT EXISTS "AdminItemAttachment_adminItemId_orderIndex_idx" ON "AdminItemAttachment" ("adminItemId", "orderIndex");
CREATE INDEX IF NOT EXISTS "AdminItemAttachment_surgeryId_idx" ON "AdminItemAttachment" ("surgeryId");

CREATE UNIQUE INDEX IF NOT EXISTS "AdminPinnedPanel_surgeryId_key" ON "AdminPinnedPanel" ("surgeryId");

CREATE UNIQUE INDEX IF NOT EXISTS "AdminDutyRotaEntry_surgeryId_date_key" ON "AdminDutyRotaEntry" ("surgeryId", "date");
CREATE INDEX IF NOT EXISTS "AdminDutyRotaEntry_surgeryId_date_idx" ON "AdminDutyRotaEntry" ("surgeryId", "date");

CREATE INDEX IF NOT EXISTS "AdminHistory_surgeryId_createdAt_idx" ON "AdminHistory" ("surgeryId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminHistory_adminItemId_idx" ON "AdminHistory" ("adminItemId");
CREATE INDEX IF NOT EXISTS "AdminHistory_adminCategoryId_idx" ON "AdminHistory" ("adminCategoryId");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminCategory_surgeryId_fkey') THEN
    ALTER TABLE "AdminCategory" ADD CONSTRAINT "AdminCategory_surgeryId_fkey"
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItem_surgeryId_fkey') THEN
    ALTER TABLE "AdminItem" ADD CONSTRAINT "AdminItem_surgeryId_fkey"
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItem_categoryId_fkey') THEN
    ALTER TABLE "AdminItem" ADD CONSTRAINT "AdminItem_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "AdminCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItem_ownerUserId_fkey') THEN
    ALTER TABLE "AdminItem" ADD CONSTRAINT "AdminItem_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItemEditor_adminItemId_fkey') THEN
    ALTER TABLE "AdminItemEditor" ADD CONSTRAINT "AdminItemEditor_adminItemId_fkey"
      FOREIGN KEY ("adminItemId") REFERENCES "AdminItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItemEditor_userId_fkey') THEN
    ALTER TABLE "AdminItemEditor" ADD CONSTRAINT "AdminItemEditor_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminListColumn_adminItemId_fkey') THEN
    ALTER TABLE "AdminListColumn" ADD CONSTRAINT "AdminListColumn_adminItemId_fkey"
      FOREIGN KEY ("adminItemId") REFERENCES "AdminItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminListRow_adminItemId_fkey') THEN
    ALTER TABLE "AdminListRow" ADD CONSTRAINT "AdminListRow_adminItemId_fkey"
      FOREIGN KEY ("adminItemId") REFERENCES "AdminItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItemAttachment_surgeryId_fkey') THEN
    ALTER TABLE "AdminItemAttachment" ADD CONSTRAINT "AdminItemAttachment_surgeryId_fkey"
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminItemAttachment_adminItemId_fkey') THEN
    ALTER TABLE "AdminItemAttachment" ADD CONSTRAINT "AdminItemAttachment_adminItemId_fkey"
      FOREIGN KEY ("adminItemId") REFERENCES "AdminItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminPinnedPanel_surgeryId_fkey') THEN
    ALTER TABLE "AdminPinnedPanel" ADD CONSTRAINT "AdminPinnedPanel_surgeryId_fkey"
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminDutyRotaEntry_surgeryId_fkey') THEN
    ALTER TABLE "AdminDutyRotaEntry" ADD CONSTRAINT "AdminDutyRotaEntry_surgeryId_fkey"
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminHistory_surgeryId_fkey') THEN
    ALTER TABLE "AdminHistory" ADD CONSTRAINT "AdminHistory_surgeryId_fkey"
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminHistory_adminItemId_fkey') THEN
    ALTER TABLE "AdminHistory" ADD CONSTRAINT "AdminHistory_adminItemId_fkey"
      FOREIGN KEY ("adminItemId") REFERENCES "AdminItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminHistory_adminCategoryId_fkey') THEN
    ALTER TABLE "AdminHistory" ADD CONSTRAINT "AdminHistory_adminCategoryId_fkey"
      FOREIGN KEY ("adminCategoryId") REFERENCES "AdminCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminHistory_actorUserId_fkey') THEN
    ALTER TABLE "AdminHistory" ADD CONSTRAINT "AdminHistory_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

