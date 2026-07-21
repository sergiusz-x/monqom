-- AlterTable
ALTER TABLE "workspaces"
ADD COLUMN "type" TEXT NOT NULL DEFAULT 'personal',
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
