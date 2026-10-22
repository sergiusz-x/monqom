# Self-hosting on Dokploy

Create a Dokploy Compose application from docker-compose.dokploy.yml with isolated deployment. Create PostgreSQL 18 as a Dokploy Database service; do not add PostgreSQL to application Compose.

Attach the public domain in Dokploy to frontend on port 8080. Keep backend and database internal. Disable ordinary main-push deployment.

Configure in Dokploy secrets: DATABASE_URL, MIGRATION_DATABASE_URL, distinct SESSION_SECRET, TOTP_ENCRYPTION_KEY, and EMAIL_OUTBOX_ENCRYPTION_KEY values of at least 32 characters, FRONTEND_URL, CORS_ALLOWED_ORIGINS, RESEND_API_KEY, EMAIL_FROM, TURNSTILE_ENABLED=true, TURNSTILE_SECRET_KEY, and VITE_TURNSTILE_SITE_KEY.

Use separate PostgreSQL roles. MIGRATION_DATABASE_URL belongs to a schema owner that can run DDL. DATABASE_URL belongs to the runtime role and should only receive CONNECT, USAGE on the application schema and sequences, plus SELECT, INSERT, UPDATE, and DELETE on application tables. Grant equivalent privileges on future tables and sequences through ALTER DEFAULT PRIVILEGES. The runtime role must not own the schema or have CREATE/DROP privileges.

Production images derive APP_VERSION and GIT_SHA from the exact checked-out release tag and commit. Untagged production builds fail unless CI supplies explicit metadata build arguments. The migration service must complete before backend startup. Set the public `PRODUCTION_URL` GitHub repository variable to the HTTPS application origin; it is not a secret. The release workflow verifies /api/ready and /version.json after each tag-triggered Dokploy deployment.

Configure S3-compatible storage and scheduled PostgreSQL backups in Dokploy. Before launch, restore a backup to an isolated temporary database and verify schema, a known account, and readiness. Use Dokploy deployment history for rollback; migrations must be forward-compatible.

## HTTPS and proxy routing

In Dokploy, attach your HTTPS domain to the frontend service on port 8080 and
use its HTTP-to-HTTPS redirect. No ingress IP/CIDR environment variable is needed.
Traefik terminates TLS and sanitizes client-supplied forwarded headers using its
default secure settings; keep `forwardedHeaders.insecure` disabled. nginx forwards
only the canonical `http`/`https` scheme and never uses `CF-Visitor` as proof of TLS.

Production Compose publishes no application host ports, disables Traefik routing
for backend/migrations and fixes the backend proxy count to two (Traefik, nginx).
Keep the Docker network private and restrict access to trusted infrastructure.
Publishing nginx/backend ports or attaching untrusted containers to that network
bypasses this trust boundary and is outside the supported deployment topology.

The container regression test checks real HTTP and HTTPS through Traefik and
nginx, including forged protocol/IP headers, without configuring any ingress IP.
