# Self-hosting on Dokploy

Create a Dokploy Compose application from docker-compose.dokploy.yml with isolated deployment. Create PostgreSQL 18 as a Dokploy Database service; do not add PostgreSQL to application Compose.

Attach the public domain in Dokploy to frontend on port 8080. Keep backend and database internal. Disable ordinary main-push deployment.

Configure in Dokploy secrets: DATABASE_URL, MIGRATION_DATABASE_URL, distinct SESSION_SECRET, TOTP_ENCRYPTION_KEY, and EMAIL_OUTBOX_ENCRYPTION_KEY values of at least 32 characters, TRUST_PROXY_HOPS (normally 1 behind Dokploy), FRONTEND_URL, CORS_ALLOWED_ORIGINS, RESEND_API_KEY, EMAIL_FROM, TURNSTILE_ENABLED=true, TURNSTILE_SECRET_KEY, and VITE_TURNSTILE_SITE_KEY.

Use separate PostgreSQL roles. MIGRATION_DATABASE_URL belongs to a schema owner that can run DDL. DATABASE_URL belongs to the runtime role and should only receive CONNECT, USAGE on the application schema and sequences, plus SELECT, INSERT, UPDATE, and DELETE on application tables. Grant equivalent privileges on future tables and sequences through ALTER DEFAULT PRIVILEGES. The runtime role must not own the schema or have CREATE/DROP privileges.

Production images derive APP_VERSION and GIT_SHA from the exact checked-out release tag and commit. Untagged production builds fail unless CI supplies explicit metadata build arguments. The migration service must complete before backend startup. Verify /api/health, /api/ready, and /version.json through the public domain after each release.

Configure S3-compatible storage and scheduled PostgreSQL backups in Dokploy. Before launch, restore a backup to an isolated temporary database and verify schema, a known account, and readiness. Use Dokploy deployment history for rollback; migrations must be forward-compatible.
