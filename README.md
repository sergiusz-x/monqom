# Monqom

## Local development stack (Docker Compose)

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
