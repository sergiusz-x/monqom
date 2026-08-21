#!/bin/sh
set -eu

: "${MIGRATION_IMAGE:?MIGRATION_IMAGE is required}"
: "${BACKEND_IMAGE:?BACKEND_IMAGE is required}"
: "${FRONTEND_IMAGE:?FRONTEND_IMAGE is required}"
: "${POSTGRES_CONTAINER:?POSTGRES_CONTAINER is required}"

smoke_port=${SMOKE_PORT:-18080}
run_suffix=${GITHUB_RUN_ID:-$$}
network=monqom-release-check-$run_suffix
backend_container=monqom-backend-release-check-$run_suffix
frontend_container=monqom-frontend-release-check-$run_suffix

cleanup() {
    docker rm -f "$frontend_container" "$backend_container" >/dev/null 2>&1 || true
    docker network disconnect "$network" "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
    docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker network create "$network" >/dev/null
docker network connect --alias database "$network" "$POSTGRES_CONTAINER"

docker run --rm --network "$network" \
    -e NODE_ENV=production \
    -e DATABASE_URL=postgresql://monqom:monqom@database:5432/monqom_container_ci \
    "$MIGRATION_IMAGE"

docker run --detach --name "$backend_container" --network "$network" --network-alias backend \
    -e NODE_ENV=production \
    -e DATABASE_URL=postgresql://monqom:monqom@database:5432/monqom_container_ci \
    -e SESSION_SECRET=01234567890123456789012345678901 \
    -e TOTP_ENCRYPTION_KEY=01234567890123456789012345678901 \
    -e FRONTEND_URL=https://app.example.test \
    -e CORS_ALLOWED_ORIGINS=https://app.example.test \
    -e RESEND_API_KEY=re_test_placeholder \
    -e EMAIL_FROM=noreply@example.test \
    -e EMAIL_OUTBOX_ENCRYPTION_KEY=01234567890123456789012345678901 \
    -e TURNSTILE_ENABLED=false \
    -e TRUST_PROXY_HOPS=1 \
    "$BACKEND_IMAGE" >/dev/null

docker run --detach --name "$frontend_container" --network "$network" \
    --publish "127.0.0.1:$smoke_port:8080" \
    "$FRONTEND_IMAGE" >/dev/null

attempt=1
while [ "$attempt" -le 60 ]; do
    if curl --fail --silent "http://127.0.0.1:$smoke_port/api/ready" >/dev/null; then
        break
    fi
    if [ "$attempt" -eq 60 ]; then
        docker logs "$backend_container" || true
        docker logs "$frontend_container" || true
        exit 1
    fi
    attempt=$((attempt + 1))
    sleep 1
done

curl --fail --silent "http://127.0.0.1:$smoke_port/version.json" >/dev/null
node scripts/smoke-production-stack.mjs \
    "http://127.0.0.1:$smoke_port" \
    "$POSTGRES_CONTAINER" \
    monqom \
    monqom_container_ci
