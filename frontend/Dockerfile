# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json ./frontend/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile
COPY frontend ./frontend
COPY packages/ui ./packages/ui
ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
WORKDIR /app/frontend
RUN pnpm run build

FROM node:22-alpine AS release
RUN apk add --no-cache git
WORKDIR /repo
ARG APP_VERSION
ARG GIT_SHA
RUN --mount=type=bind,source=.git,target=/repo/.git,readonly \
    set -eu; \
    sha="${GIT_SHA:-$(git rev-parse HEAD)}"; \
    if [ -n "${APP_VERSION:-}" ]; then \
      version="$APP_VERSION"; \
    elif exact_tag="$(git describe --exact-match --tags HEAD 2>/dev/null)"; then \
      version="$exact_tag"; \
    else \
      version="sha-$(printf '%s' "$sha" | cut -c1-12)"; \
    fi; \
    printf '{"version":"%s","sha":"%s"}\n' "$version" "$sha" > /version.json

FROM nginxinc/nginx-unprivileged:1.29.8-alpine@sha256:0c79d56aee561a1d81c63f00eee5fb5fe29279560cdc55e91425133104c7fbe6
USER root
RUN apk upgrade --no-cache
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY --from=release /version.json /usr/share/nginx/html/version.json
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
