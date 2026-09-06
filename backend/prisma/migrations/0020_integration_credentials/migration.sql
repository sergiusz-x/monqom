CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "integrations_status_check" CHECK ("status" IN ('active', 'disabled', 'deleted'))
);

CREATE TABLE "integration_credentials" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "token_digest" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "category_allowlist_enabled" BOOLEAN NOT NULL DEFAULT false,
    "payment_source_allowlist_enabled" BOOLEAN NOT NULL DEFAULT false,
    "cidr_allowlist_enabled" BOOLEAN NOT NULL DEFAULT false,
    "allowed_cidrs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "integration_credentials_status_check" CHECK ("status" IN ('active', 'revoked')),
    CONSTRAINT "integration_credentials_expiry_check" CHECK ("expires_at" > "created_at")
);

CREATE TABLE "integration_credential_categories" (
    "credential_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    CONSTRAINT "integration_credential_categories_pkey" PRIMARY KEY ("credential_id", "category_id")
);

CREATE TABLE "integration_credential_payment_sources" (
    "credential_id" TEXT NOT NULL,
    "payment_source_id" TEXT NOT NULL,
    CONSTRAINT "integration_credential_payment_sources_pkey" PRIMARY KEY ("credential_id", "payment_source_id")
);

CREATE UNIQUE INDEX "integrations_workspace_id_id_key" ON "integrations"("workspace_id", "id");
CREATE INDEX "integrations_workspace_id_status_idx" ON "integrations"("workspace_id", "status");
CREATE INDEX "integrations_created_by_user_id_idx" ON "integrations"("created_by_user_id");
CREATE UNIQUE INDEX "integration_credentials_token_prefix_key" ON "integration_credentials"("token_prefix");
CREATE UNIQUE INDEX "integration_credentials_token_digest_key" ON "integration_credentials"("token_digest");
CREATE INDEX "integration_credentials_integration_id_status_idx" ON "integration_credentials"("integration_id", "status");
CREATE INDEX "integration_credentials_expires_at_idx" ON "integration_credentials"("expires_at");
CREATE INDEX "integration_credential_categories_category_id_idx" ON "integration_credential_categories"("category_id");
CREATE INDEX "integration_credential_payment_sources_payment_source_id_idx" ON "integration_credential_payment_sources"("payment_source_id");

ALTER TABLE "integrations" ADD CONSTRAINT "integrations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_credential_categories" ADD CONSTRAINT "integration_credential_categories_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "integration_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_credential_categories" ADD CONSTRAINT "integration_credential_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_credential_payment_sources" ADD CONSTRAINT "integration_credential_payment_sources_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "integration_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_credential_payment_sources" ADD CONSTRAINT "integration_credential_payment_sources_payment_source_id_fkey" FOREIGN KEY ("payment_source_id") REFERENCES "payment_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
