# Monqom

Monqom is a self-hostable personal-finance application. See the [release policy](docs/releases.md) for the supported release and deployment model.

## Local development

Start backend + PostgreSQL with a single command:

```bash
docker compose -f docker-compose.dev.yml up --build
```

The stack exposes:

- Backend API: `http://localhost:3000`
- Health check: `http://localhost:3000/health`
- PostgreSQL: `localhost:5432`

Stop the stack:

```bash
docker compose -f docker-compose.dev.yml down
```

## Generating OpenAPI client

Whenever the backend API changes, regenerate the OpenAPI spec and the TypeScript client:

```bash
# Generate OpenAPI spec from NestJS app
pnpm --filter backend run openapi:generate

# Generate TypeScript client (axios) from the spec
pnpm --filter backend run client:generate
```

The generated client will be placed under `frontend/src/api/client/`. Commit the generated files.

Make sure to commit both `backend/spec/openapi.json` and the client files.
