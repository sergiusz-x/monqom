# Self-hosting on Dokploy

Create a Dokploy Compose application from docker-compose.dokploy.yml with isolated deployment. Create PostgreSQL 18 as a Dokploy Database service; do not add PostgreSQL to application Compose.

Attach the public domain in Dokploy to frontend on port 8080. Keep backend and database internal. Disable ordinary main-push deployment.

Configure in Dokploy secrets: DATABASE_URL, MIGRATION_DATABASE_URL, distinct SESSION_SECRET, TOTP_ENCRYPTION_KEY, and EMAIL_OUTBOX_ENCRYPTION_KEY values of at least 32 characters, TRUST_PROXY_HOPS (normally 1 behind Dokploy), FRONTEND_URL, CORS_ALLOWED_ORIGINS, RESEND_API_KEY, EMAIL_FROM, TURNSTILE_ENABLED=true, TURNSTILE_SECRET_KEY, and VITE_TURNSTILE_SITE_KEY.

Use separate PostgreSQL roles. MIGRATION_DATABASE_URL belongs to a schema owner that can run DDL. DATABASE_URL belongs to the runtime role and should only receive CONNECT, USAGE on the application schema and sequences, plus SELECT, INSERT, UPDATE, and DELETE on application tables. Grant equivalent privileges on future tables and sequences through ALTER DEFAULT PRIVILEGES. The runtime role must not own the schema or have CREATE/DROP privileges.

Production images derive APP_VERSION and GIT_SHA from the exact checked-out release tag and commit. Untagged production builds fail unless CI supplies explicit metadata build arguments. The migration service must complete before backend startup. Verify /api/health, /api/ready, and /version.json through the public domain after each release.

## Immutable hosted deployment

`docker-compose.immutable.yml` is the image-only production manifest. It requires three GHCR `name@sha256` references and contains no build directives or secrets. The normal source-build Compose file remains available for self-hosting and for the first hosted-deployment bootstrap.

Before enabling automated deployment:

1. Create a protected GitHub environment named `production` and require owner approval.
2. Add the repository variable `DOKPLOY_DEPLOY_ENABLED=true`. In the protected `production` environment add variables `DOKPLOY_URL` and `PRODUCTION_URL`, plus secrets `DOKPLOY_COMPOSE_ID` and `DOKPLOY_API_KEY`. Use HTTPS URLs and a dedicated Dokploy credential with the narrowest available access to this Compose application.
3. Give the Dokploy host read-only access to the three GHCR packages, or explicitly make those packages public. Never put a registry token in Compose or an image.
4. Confirm the database backup and previous tagged rollback target, then disable Dokploy's automatic tag deployment before setting `DOKPLOY_DEPLOY_ENABLED=true`. Publish the controlled release, approve the GitHub production deployment, and verify its SHA. The old exact tag remains available for a manual source deployment if first-time recovery is required; never enable both automatic deployment paths together.

Every later rollout stores the current image-only manifest before updating Dokploy. Public `/api/ready` and `/version.json` checks retry during startup and require the expected commit SHA. On sustained failure, the workflow restores the previous three image digests and redeploys them. It does not and must not reverse the database migration.

Database changes therefore follow expand/contract delivery: add compatible schema first, deploy code that tolerates both versions, and remove obsolete schema only in a later release after the rollback window closes. If the first immutable rollout fails before a previous digest manifest exists, use the prior tagged source deployment from Dokploy history and investigate before enabling automation again.

Configure S3-compatible storage and scheduled PostgreSQL backups in Dokploy. Before launch, restore a backup to an isolated temporary database and verify schema, a known account, and readiness. Use Dokploy deployment history for rollback; migrations must be forward-compatible.
