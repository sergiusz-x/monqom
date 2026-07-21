# Self-hosting on Dokploy

Create a Dokploy Compose application from docker-compose.dokploy.yml with isolated deployment. Create PostgreSQL 18 as a Dokploy Database service; do not add PostgreSQL to application Compose.

Attach the public domain in Dokploy to frontend on port 8080. Keep backend and database internal. Disable ordinary main-push deployment.

Configure in Dokploy secrets: DATABASE_URL, distinct SESSION_SECRET and TOTP_ENCRYPTION_KEY values of at least 32 characters, FRONTEND_URL, CORS_ALLOWED_ORIGINS, RESEND_API_KEY, EMAIL_FROM, TURNSTILE_ENABLED=true, TURNSTILE_SECRET_KEY, VITE_TURNSTILE_SITE_KEY, APP_VERSION, and GIT_SHA.

The migration service must complete before backend startup. Verify /health, /ready, and /version.json through the public domain after each release.

Configure S3-compatible storage and scheduled PostgreSQL backups in Dokploy. Before launch, restore a backup to an isolated temporary database and verify schema, a known account, and readiness. Use Dokploy deployment history for rollback; migrations must be forward-compatible.
