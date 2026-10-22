BEGIN;

-- Keep manual rows unchanged and allow an imported record to await categorization.
ALTER TABLE "transactions" ALTER COLUMN "category_id" DROP NOT NULL;
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_integration_id_fkey";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspace_id_integration_id_fkey"
  FOREIGN KEY ("workspace_id", "integration_id") REFERENCES "integrations"("workspace_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_external_owner_check"
  CHECK ("external_id" IS NULL OR "integration_id" IS NOT NULL);

ALTER TABLE "integration_idempotency_records"
  ADD COLUMN "workspace_id" TEXT,
  ADD COLUMN "response_etag" TEXT,
  ADD COLUMN "target_transaction_id" TEXT,
  ADD COLUMN "retained_category_id" TEXT,
  ADD COLUMN "retained_payment_source_id" TEXT,
  ADD COLUMN "lease_expires_at" TIMESTAMP(3),
  ADD COLUMN "completed_at" TIMESTAMP(3);
UPDATE "integration_idempotency_records" r SET
  "workspace_id" = i."workspace_id",
  "target_transaction_id" = r."response_body"->>'id',
  "retained_category_id" = r."response_body"->>'categoryId',
  "retained_payment_source_id" = r."response_body"->>'paymentSourceId',
  "response_etag" = CASE WHEN r."response_body"->>'version' IS NOT NULL
    THEN '"tx-v' || (r."response_body"->>'version') || '"' END,
  "completed_at" = CASE WHEN r."status" = 'completed' THEN r."updated_at" END,
  "lease_expires_at" = CASE WHEN r."status" = 'in_progress' THEN r."created_at" + INTERVAL '5 minutes' END,
  "expires_at" = CASE WHEN r."status" = 'completed' THEN r."updated_at" + INTERVAL '7 days' ELSE r."expires_at" END
FROM "integrations" i WHERE r."integration_id" = i."id";
ALTER TABLE "integration_idempotency_records" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "integration_idempotency_records" DROP CONSTRAINT "integration_idempotency_records_integration_id_fkey";
ALTER TABLE "integration_idempotency_records" ADD CONSTRAINT "integration_idempotency_records_workspace_id_integration_i_fkey"
  FOREIGN KEY ("workspace_id", "integration_id") REFERENCES "integrations"("workspace_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Browser edits, tag replacements and soft deletes invalidate machine preconditions too.
CREATE FUNCTION advance_external_transaction_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.integration_id IS NOT NULL THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER transactions_external_version BEFORE UPDATE ON "transactions"
  FOR EACH ROW EXECUTE FUNCTION advance_external_transaction_version();

COMMIT;
