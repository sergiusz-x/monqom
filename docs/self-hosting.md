# Self-hosting Monqom

This guide runs Monqom with Docker Compose and PostgreSQL. It requires a domain with HTTPS,
a reverse proxy, and a [Resend](https://resend.com/) account with a verified sending domain.
Registration verification and password reset require working email delivery. For Dokploy, see
[the Dokploy guide](dokploy.md).

## Requirements

- Docker with Compose v2.20 or later and a checkout of this repository, including `.git`.
- A public HTTPS domain and a reverse proxy on the same machine as Docker.
- Resend API key and verified sender. Turnstile is optional.

## Configure

Copy `.env.self-host.example` to `.env.self-host`. Keep this file private and never commit it.
Set `FRONTEND_URL` to your HTTPS origin without a trailing slash, `RESEND_API_KEY`, and
`EMAIL_FROM`. Generate three **different** secrets with `openssl rand -hex 32` and use them
for `SESSION_SECRET`, `TOTP_ENCRYPTION_KEY`, and `EMAIL_OUTBOX_ENCRYPTION_KEY`. Back up these
keys securely: changing encryption keys makes previously encrypted data unreadable.

For the included PostgreSQL, generate a separate password with `openssl rand -hex 32`, set
`POSTGRES_PASSWORD`, and use the same value in `DATABASE_URL`. The example database host is
`postgres`; do not use `localhost` inside a container. If using other credentials in a database
URL, percent-encode special characters in the username and password.

The included database uses one account for both migrations and the application for a simple
setup. For stronger isolation, create a separate schema owner and runtime role and set
`MIGRATION_DATABASE_URL`; the runtime role needs only the permissions described in the
[Dokploy guide](dokploy.md). To use an existing PostgreSQL 18 server, set `DATABASE_URL` to its
reachable address and omit `--profile local-db` from all Compose commands. Back up that server
separately.

## Start

For the included database:

```sh
docker compose --env-file .env.self-host -f docker-compose.self-host.yml --profile local-db up -d --build
```

Compose runs database migrations before starting the backend. The frontend listens on
`127.0.0.1:8080`; PostgreSQL and the backend are not published. Set `FRONTEND_PORT` to change
the local port. Check the services with:

```sh
docker compose --env-file .env.self-host -f docker-compose.self-host.yml --profile local-db ps
curl http://127.0.0.1:8080/api/ready
```

Configure your reverse proxy to terminate HTTPS and forward requests for your domain to
`http://127.0.0.1:8080`. It must discard client-supplied `X-Forwarded-For` and
`X-Forwarded-Proto`, then set them from the actual connection. This deployment assumes exactly
one trusted TLS proxy before Monqom's nginx; do not put untrusted proxies or containers on the
private network. Keep the origin port bound to localhost. The app requires HTTPS in production:
direct HTTP access is only useful for health checks, not a working login session.

For example, if Caddy runs directly on the host and receives requests directly from the
internet, its Caddyfile can contain the following. Point DNS to the server and allow ports 80
and 443 so Caddy can obtain a certificate. This example does not cover an additional CDN or proxy.

```caddyfile
monqom.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

See [Caddy's reverse proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
for its forwarded-header behavior and trusted proxy settings.

If enabling Turnstile, set `TURNSTILE_ENABLED=true`, `TURNSTILE_SECRET_KEY`, and
`VITE_TURNSTILE_SITE_KEY` from the same Cloudflare widget; rebuild the frontend after changes.
With it disabled, leave the site key empty. Open the HTTPS origin, register, verify the email,
and log in.

## Backups and updates

Back up the database regularly and store encrypted copies separately from the server. The command
below creates a PostgreSQL custom-format backup of the included database. Run it from a secure
location; the file contains private financial data and is not encrypted by this command.

```sh
docker compose --env-file .env.self-host -f docker-compose.self-host.yml --profile local-db exec -T postgres sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > monqom.dump
```

To verify a backup, restore it into a **separate, disposable** PostgreSQL 18 container, not the
live database. This example does not publish a port. Use a unique container name and a temporary
password, and wait until `pg_isready` succeeds before restoring:

```sh
docker run -d --name monqom-restore-check --network none -e POSTGRES_PASSWORD=temporary-test-password postgres:18-alpine
docker exec monqom-restore-check pg_isready -U postgres
docker exec -i monqom-restore-check pg_restore --exit-on-error --no-owner --no-privileges -U postgres -d postgres < monqom.dump
docker exec monqom-restore-check psql -U postgres -d postgres -c '\dt'
```

Check that the expected tables and synthetic or authorized records exist. The isolated test still
contains private data: remove it with `docker rm -f monqom-restore-check` and protect or securely
remove the dump afterward. Before restoring an older backup to production, account for subsequent
account deletions and security changes.

Before updating, back up the database and keys, review release notes and check migration
compatibility. Check out the desired release, then repeat the `up -d --build` command above;
the migration service applies pending migrations. Check `/api/ready` and sign in. Rolling back
application images does not reverse database migrations: use a compatible release or restore a
verified backup after assessing data loss.

## Troubleshooting

Use `docker compose --env-file .env.self-host -f docker-compose.self-host.yml --profile local-db logs migrate backend frontend`
to inspect startup errors. Do not share logs containing personal data or secrets. Check that the
database is reachable and credentials match; changing `POSTGRES_PASSWORD` in the environment
does not change an existing PostgreSQL volume's password. For registration email, verify the
Resend key, sender domain, and provider delivery logs. For login issues, check HTTPS,
`FRONTEND_URL`, and the trusted reverse proxy configuration.

To stop the stack without deleting the database, run `docker compose --env-file .env.self-host -f docker-compose.self-host.yml --profile local-db down`.
Do not add `--volumes` unless you intend to delete the local database.
