# Contributing

Use Node.js 22 and Docker Compose. Copy .env.example to .env, set local-only values, and start docker compose with docker-compose.dev.yml.

Use Conventional Commits. Include tests for behavioral changes, avoid unrelated formatting churn, and never include secrets or user data. Changes affecting authentication, authorization, money, database migrations, sessions, or deployment require explicit verification notes.


## Generating the OpenAPI client

When modifying backend endpoints, remember to regenerate the OpenAPI specification and the TypeScript client:

```bash
# Generate OpenAPI spec from NestJS app
pnpm --filter backend run openapi:generate

# Generate TypeScript client (axios) from the spec
pnpm --filter backend run client:generate
```

Commit the updated `backend/spec/openapi.json` and the regenerated files under `frontend/src/api/client/`.
