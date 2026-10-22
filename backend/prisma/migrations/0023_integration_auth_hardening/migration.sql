-- Keep durable attribution when the human creator deletes their account.
ALTER TABLE "integrations" ADD COLUMN "creator_reference" TEXT;
UPDATE "integrations" SET "creator_reference" = "created_by_user_id";
ALTER TABLE "integrations" ALTER COLUMN "creator_reference" SET NOT NULL;
ALTER TABLE "integrations" ALTER COLUMN "created_by_user_id" DROP NOT NULL;
ALTER TABLE "integrations" DROP CONSTRAINT "integrations_created_by_user_id_fkey";
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "integration_credentials" ADD COLUMN "last_used_ip" TEXT;

-- NOT VALID preserves existing installations for review, but enforces policy on all new writes.
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_max_lifetime_check"
    CHECK ("status" = 'revoked' OR "expires_at" <= "created_at" + INTERVAL '365 days') NOT VALID;
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_material_check"
    CHECK ("status" = 'revoked' OR
        ("token_prefix" ~ '^mqic_[A-Za-z0-9_-]{12}$' AND "token_digest" ~ '^[0-9a-f]{64}$')) NOT VALID;
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_scopes_check"
    CHECK ("status" = 'revoked' OR ("scopes" <@ ARRAY['transactions:create', 'transactions:read-own',
        'transactions:update-own', 'transactions:delete-own', 'categories:read',
        'payment-sources:read']::TEXT[] AND array_position("scopes", NULL) IS NULL)) NOT VALID;
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_revocation_check"
    CHECK (("status" = 'active' AND "revoked_at" IS NULL)
        OR ("status" = 'revoked' AND "revoked_at" IS NOT NULL)) NOT VALID;

CREATE TABLE "integration_rate_limits" (
    "key_hash" TEXT NOT NULL PRIMARY KEY,
    "request_times" TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[],
    "mutation_times" TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[],
    "blocked_until" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "integration_rate_limits_expires_at_idx" ON "integration_rate_limits"("expires_at");

-- Match the authority lock taken by issuance, rotation and explicit revocation.
-- A membership mutation can commit only after all credentials have been revoked.
CREATE FUNCTION revoke_integration_creator_authority(p_workspace TEXT, p_user TEXT, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    -- Workspace deletion already cascades credentials and their audit history. Do not
    -- insert an audit row referencing a workspace being deleted by this transaction.
    IF NOT EXISTS (SELECT 1 FROM "workspaces" WHERE "id" = p_workspace) THEN
        RETURN;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('integration-authority:' || p_workspace || ':' || p_user, 0));
    WITH revoked AS (
        UPDATE "integration_credentials" AS c
        SET "status" = 'revoked', "revoked_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
        FROM "integrations" AS i
        WHERE c."integration_id" = i."id" AND i."workspace_id" = p_workspace
          AND i."created_by_user_id" = p_user AND c."status" = 'active'
        RETURNING c.*
    )
    INSERT INTO "audit_events" ("id", "workspace_id", "action", "entity_type", "entity_id", "metadata", "updated_at")
    SELECT gen_random_uuid()::TEXT, i."workspace_id", 'INTEGRATION_CREDENTIAL_REVOKED',
        'INTEGRATION_CREDENTIAL', revoked."id", jsonb_build_object(
            'integration_id', revoked."integration_id", 'credential_id', revoked."id",
            'token_prefix', revoked."token_prefix", 'creator_reference', i."creator_reference",
            'previous_status', 'active', 'new_status', 'revoked',
            'expires_at', revoked."expires_at", 'scopes', revoked."scopes", 'reason', p_reason,
            'category_allowlist_enabled', revoked."category_allowlist_enabled",
            'payment_source_allowlist_enabled', revoked."payment_source_allowlist_enabled",
            'cidr_allowlist_enabled', revoked."cidr_allowlist_enabled"), CURRENT_TIMESTAMP
    FROM revoked
    JOIN "integrations" AS i ON i."id" = revoked."integration_id";
END;
$$;

CREATE FUNCTION integration_membership_authority_changed() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM revoke_integration_creator_authority(OLD."workspace_id", OLD."user_id", 'CREATOR_REMOVED');
        RETURN OLD;
    END IF;
    IF OLD."workspace_id" IS DISTINCT FROM NEW."workspace_id"
       OR OLD."user_id" IS DISTINCT FROM NEW."user_id"
       OR (OLD."role" IN ('owner', 'admin') AND NEW."role" NOT IN ('owner', 'admin')) THEN
        PERFORM revoke_integration_creator_authority(OLD."workspace_id", OLD."user_id", 'CREATOR_AUTHORITY_LOST');
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "integration_membership_authority_changed"
    AFTER UPDATE OR DELETE ON "workspace_memberships"
    FOR EACH ROW EXECUTE FUNCTION integration_membership_authority_changed();

CREATE FUNCTION integration_creator_account_deleted() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE item RECORD;
BEGIN
    FOR item IN SELECT DISTINCT "workspace_id" FROM "integrations"
        WHERE "created_by_user_id" = OLD."id" ORDER BY "workspace_id"
    LOOP
        PERFORM revoke_integration_creator_authority(item."workspace_id", OLD."id", 'CREATOR_ACCOUNT_DELETED');
    END LOOP;
    RETURN OLD;
END;
$$;
CREATE TRIGGER "integration_creator_account_deleted" BEFORE DELETE ON "users"
    FOR EACH ROW EXECUTE FUNCTION integration_creator_account_deleted();

CREATE FUNCTION protect_integration_identity() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD."id" IS DISTINCT FROM NEW."id"
       OR OLD."workspace_id" IS DISTINCT FROM NEW."workspace_id"
       OR OLD."creator_reference" IS DISTINCT FROM NEW."creator_reference"
       OR (NEW."created_by_user_id" IS NOT NULL AND OLD."created_by_user_id" IS DISTINCT FROM NEW."created_by_user_id") THEN
        RAISE EXCEPTION 'Integration ownership is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "protect_integration_identity" BEFORE UPDATE ON "integrations"
    FOR EACH ROW EXECUTE FUNCTION protect_integration_identity();

CREATE FUNCTION protect_integration_credential_identity() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD."id" IS DISTINCT FROM NEW."id"
       OR OLD."integration_id" IS DISTINCT FROM NEW."integration_id"
       OR OLD."token_prefix" IS DISTINCT FROM NEW."token_prefix"
       OR OLD."token_digest" IS DISTINCT FROM NEW."token_digest"
       OR OLD."created_at" IS DISTINCT FROM NEW."created_at"
       OR (OLD."status" = 'revoked' AND (NEW."status" <> 'revoked' OR OLD."revoked_at" IS DISTINCT FROM NEW."revoked_at")) THEN
        RAISE EXCEPTION 'Credential identity and revocation are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "protect_integration_credential_identity" BEFORE UPDATE ON "integration_credentials"
    FOR EACH ROW EXECUTE FUNCTION protect_integration_credential_identity();

-- Revoke legacy credentials whose creator already lacks authority.
DO $$
DECLARE item RECORD;
BEGIN
    FOR item IN SELECT DISTINCT i."workspace_id", i."created_by_user_id" FROM "integrations" i
        WHERE NOT EXISTS (SELECT 1 FROM "workspace_memberships" m
            WHERE m."workspace_id" = i."workspace_id" AND m."user_id" = i."created_by_user_id"
              AND m."role" IN ('owner', 'admin'))
    LOOP
        PERFORM revoke_integration_creator_authority(item."workspace_id", item."created_by_user_id", 'CREATOR_AUTHORITY_LOST');
    END LOOP;
END;
$$;
