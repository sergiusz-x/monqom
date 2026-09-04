ALTER TABLE "transactions" ADD COLUMN "integration_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN "external_id" TEXT;
CREATE UNIQUE INDEX "transactions_workspace_id_integration_id_external_id_key" ON "transactions"("workspace_id", "integration_id", "external_id");
CREATE INDEX "transactions_workspace_id_integration_id_external_id_idx" ON "transactions"("workspace_id", "integration_id", "external_id");
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "integration_idempotency_records" (
  "id" TEXT NOT NULL, "integration_id" TEXT NOT NULL, "key_digest" TEXT NOT NULL,
  "operation" TEXT NOT NULL, "target_external_id" TEXT, "request_fingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'in_progress', "response_status" INTEGER, "response_body" JSONB,
  "expires_at" TIMESTAMP(3) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_idempotency_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_idempotency_records_status_check" CHECK ("status" IN ('in_progress','completed'))
);
CREATE UNIQUE INDEX "integration_idempotency_records_integration_id_key_digest_key" ON "integration_idempotency_records"("integration_id", "key_digest");
CREATE INDEX "integration_idempotency_records_expires_at_idx" ON "integration_idempotency_records"("expires_at");
ALTER TABLE "integration_idempotency_records" ADD CONSTRAINT "integration_idempotency_records_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
