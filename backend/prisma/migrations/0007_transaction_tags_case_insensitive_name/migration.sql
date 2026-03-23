-- CreateIndex
CREATE UNIQUE INDEX "transaction_tags_workspace_id_transaction_id_name_lower_key"
ON "transaction_tags" ("workspace_id", "transaction_id", LOWER("name"));
