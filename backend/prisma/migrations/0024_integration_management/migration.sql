-- Hide revoked credential versions without destroying lifecycle or ownership evidence.
ALTER TABLE "integration_credentials" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_safe_delete_check"
    CHECK ("deleted_at" IS NULL OR ("status" = 'revoked' AND "revoked_at" IS NOT NULL));

CREATE FUNCTION protect_integration_credential_deletion() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD."deleted_at" IS NOT NULL AND OLD."deleted_at" IS DISTINCT FROM NEW."deleted_at" THEN
        RAISE EXCEPTION 'Credential deletion is irreversible' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "protect_integration_credential_deletion" BEFORE UPDATE ON "integration_credentials"
    FOR EACH ROW EXECUTE FUNCTION protect_integration_credential_deletion();
