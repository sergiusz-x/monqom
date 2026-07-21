ALTER TABLE "payment_sources" ADD COLUMN "system_key" TEXT;

WITH existing_cash AS (
    SELECT DISTINCT ON ("workspace_id") "id"
    FROM "payment_sources"
    WHERE "type" = 'cash' AND "deleted_at" IS NULL
    ORDER BY "workspace_id", "created_at", "id"
)
UPDATE "payment_sources"
SET "system_key" = 'cash', "name" = 'Cash', "type" = 'cash'
WHERE "id" IN (SELECT "id" FROM existing_cash);

INSERT INTO "payment_sources" (
    "id", "workspace_id", "name", "type", "system_key", "created_at", "updated_at"
)
SELECT gen_random_uuid(), w."id", 'Cash', 'cash', 'cash', NOW(), NOW()
FROM "workspaces" w
WHERE NOT EXISTS (
    SELECT 1 FROM "payment_sources" ps
    WHERE ps."workspace_id" = w."id" AND ps."system_key" = 'cash'
);

UPDATE "transactions" t
SET "payment_source_id" = ps."id"
FROM "payment_sources" ps
WHERE t."payment_source_id" IS NULL
  AND ps."workspace_id" = t."workspace_id"
  AND ps."system_key" = 'cash';

UPDATE "workspace_memberships" wm
SET "last_payment_source_id" = ps."id"
FROM "payment_sources" ps
WHERE ps."workspace_id" = wm."workspace_id"
  AND ps."system_key" = 'cash'
  AND (
    wm."last_payment_source_id" IS NULL OR NOT EXISTS (
      SELECT 1 FROM "payment_sources" current_ps
      WHERE current_ps."workspace_id" = wm."workspace_id"
        AND current_ps."id" = wm."last_payment_source_id"
        AND current_ps."deleted_at" IS NULL
    )
  );

ALTER TABLE "transactions" DROP CONSTRAINT "transactions_workspace_id_payment_source_id_fkey";
ALTER TABLE "transactions" ALTER COLUMN "payment_source_id" SET NOT NULL;
ALTER TABLE "workspace_memberships" ALTER COLUMN "last_payment_source_id" SET NOT NULL;

CREATE UNIQUE INDEX "payment_sources_workspace_id_system_key_key"
ON "payment_sources"("workspace_id", "system_key");

CREATE UNIQUE INDEX "payment_sources_active_name_key"
ON "payment_sources"("workspace_id", LOWER(BTRIM("name")))
WHERE "deleted_at" IS NULL;

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_workspace_id_payment_source_id_fkey"
FOREIGN KEY ("workspace_id", "payment_source_id")
REFERENCES "payment_sources"("workspace_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workspace_memberships"
ADD CONSTRAINT "workspace_memberships_workspace_id_last_payment_source_id_fkey"
FOREIGN KEY ("workspace_id", "last_payment_source_id")
REFERENCES "payment_sources"("workspace_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;