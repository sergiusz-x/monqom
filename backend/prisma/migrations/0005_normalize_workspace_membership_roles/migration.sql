ALTER TABLE "workspace_memberships"
ALTER COLUMN "role" SET DEFAULT 'member';

UPDATE "workspace_memberships"
SET "role" = LOWER("role")
WHERE "role" <> LOWER("role");
