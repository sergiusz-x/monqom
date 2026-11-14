# Contributing

## Setup

Use Node.js 22, pnpm 9.15.9 (via Corepack), and Docker with Compose v2. Clone the
repository, then create a local-only configuration:

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
```

Replace the example values in `.env` with local credentials and distinct random secrets. Never
put production credentials or user data in development. Start the development stack with
`docker compose -f docker-compose.dev.yml up --build`; the frontend is at
`http://localhost:5173`. Stop it with `docker compose -f docker-compose.dev.yml down`.
Stopping the stack keeps its database volume; `down --volumes` deletes it.

## Checks

Run the checks relevant to your change from the repository root:

```sh
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

For a single package, use `pnpm --filter frontend test` or `pnpm --filter backend test`.
Database integration tests require a separate, disposable PostgreSQL database with a `test`
segment in its name. Set `INTEGRATION_TEST_DATABASE_URL`, apply migrations to that database
using `DATABASE_URL`, then run `pnpm --filter backend run test:e2e:db`. Never point these tests
at development or production data. CI runs additional format, migration, API-contract and
browser/container checks; see `.github/workflows/ci.yml` for the complete list.

## Changes and pull requests

Use Conventional Commits, keep changes focused, and include meaningful tests for behavior
changes. Describe what changed, why, and how it was verified. Changes affecting authentication,
authorization, money, migrations, sessions, or deployment need explicit verification notes.
Never include secrets, production URLs with credentials, user data or tokens. Report security
issues as described in [SECURITY.md](SECURITY.md).

## API client

When an API contract changes, regenerate both artifacts and commit the result:

```sh
pnpm --filter backend run openapi:generate
pnpm --filter backend run client:generate
```

This updates `backend/spec/openapi.json` and `frontend/src/api/client/`. The client generator
requires Java; see the CI workflow for its pinned generator version and checksum.
