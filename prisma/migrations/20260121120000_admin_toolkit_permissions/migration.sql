-- Admin Toolkit permissions: category visibility + per-item edit grants

-- CreateEnum
CREATE TYPE "SurgeryRole" AS ENUM ('ADMIN', 'STANDARD');

-- CreateEnum
CREATE TYPE "AdminCategoryVisibilityMode" AS ENUM ('ALL', 'ROLES', 'USERS', 'ROLES_OR_USERS');

-- CreateEnum
CREATE TYPE "AdminItemEditGrantPrincipalType" AS ENUM ('USER', 'ROLE');

-- AlterTable
ALTER TABLE "AdminCategory"
ADD COLUMN "visibilityMode" "AdminCategoryVisibilityMode" NOT NULL DEFAULT 'ALL',
ADD COLUMN "visibilityRoles" "SurgeryRole"[] NOT NULL DEFAULT ARRAY[]::"SurgeryRole"[];

-- CreateTable
CREATE TABLE "AdminCategoryVisibleUser" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "adminCategoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminCategoryVisibleUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminItemEditGrant" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "adminItemId" TEXT NOT NULL,
    "principalType" "AdminItemEditGrantPrincipalType" NOT NULL,
    "userId" TEXT,
    "role" "SurgeryRole",
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminItemEditGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminCategoryVisibleUser_adminCategoryId_userId_key" ON "AdminCategoryVisibleUser"("adminCategoryId", "userId");
CREATE INDEX "AdminCategoryVisibleUser_surgeryId_idx" ON "AdminCategoryVisibleUser"("surgeryId");
CREATE INDEX "AdminCategoryVisibleUser_adminCategoryId_idx" ON "AdminCategoryVisibleUser"("adminCategoryId");
CREATE INDEX "AdminCategoryVisibleUser_userId_idx" ON "AdminCategoryVisibleUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminItemEditGrant_adminItemId_userId_key" ON "AdminItemEditGrant"("adminItemId", "userId");
CREATE UNIQUE INDEX "AdminItemEditGrant_adminItemId_role_key" ON "AdminItemEditGrant"("adminItemId", "role");
CREATE INDEX "AdminItemEditGrant_surgeryId_idx" ON "AdminItemEditGrant"("surgeryId");
CREATE INDEX "AdminItemEditGrant_adminItemId_idx" ON "AdminItemEditGrant"("adminItemId");
CREATE INDEX "AdminItemEditGrant_userId_idx" ON "AdminItemEditGrant"("userId");

-- AddForeignKey
ALTER TABLE "AdminCategoryVisibleUser" ADD CONSTRAINT "AdminCategoryVisibleUser_surgeryId_fkey"
FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminCategoryVisibleUser" ADD CONSTRAINT "AdminCategoryVisibleUser_adminCategoryId_fkey"
FOREIGN KEY ("adminCategoryId") REFERENCES "AdminCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminCategoryVisibleUser" ADD CONSTRAINT "AdminCategoryVisibleUser_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminItemEditGrant" ADD CONSTRAINT "AdminItemEditGrant_surgeryId_fkey"
FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminItemEditGrant" ADD CONSTRAINT "AdminItemEditGrant_adminItemId_fkey"
FOREIGN KEY ("adminItemId") REFERENCES "AdminItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminItemEditGrant" ADD CONSTRAINT "AdminItemEditGrant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminItemEditGrant" ADD CONSTRAINT "AdminItemEditGrant_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce well-formed principals
ALTER TABLE "AdminItemEditGrant"
ADD CONSTRAINT "AdminItemEditGrant_principal_check" CHECK (
  ("principalType" = 'USER' AND "userId" IS NOT NULL AND "role" IS NULL)
  OR
  ("principalType" = 'ROLE' AND "role" IS NOT NULL AND "userId" IS NULL)
);

