ALTER TABLE "email_verification_tokens"
ADD COLUMN "token_hash" TEXT;

ALTER TABLE "password_reset_tokens"
ADD COLUMN "token_hash" TEXT;

CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key"
ON "email_verification_tokens"("token_hash");

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key"
ON "password_reset_tokens"("token_hash");

CREATE TABLE "auth_rate_limits" (
    "key_hash" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMP(3) NOT NULL,
    "blocked_until" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("key_hash")
);

CREATE INDEX "auth_rate_limits_expires_at_idx"
ON "auth_rate_limits"("expires_at");

CREATE TABLE "email_outbox" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "encrypted_payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_outbox_kind_check" CHECK ("kind" IN ('password_reset', 'verification')),
    CONSTRAINT "email_outbox_status_check" CHECK ("status" IN ('pending', 'processing', 'sent', 'failed')),
    CONSTRAINT "email_outbox_attempts_check" CHECK ("attempts" >= 0)
);

CREATE INDEX "email_outbox_status_available_at_idx"
ON "email_outbox"("status", "available_at");

CREATE TABLE IF NOT EXISTS "user_sessions" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire"
ON "user_sessions"("expire");

ALTER TABLE "workspace_memberships"
ADD CONSTRAINT "workspace_memberships_role_check"
CHECK ("role" IN ('owner', 'admin', 'member'));

CREATE UNIQUE INDEX "categories_active_sibling_name_key"
ON "categories" (
    "workspace_id",
    COALESCE("parent_id", ''),
    "type",
    LOWER("name")
)
WHERE "deleted_at" IS NULL;
