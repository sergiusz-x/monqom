# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend .
ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
RUN npm run build

FROM node:22-alpine AS release
RUN apk add --no-cache git
WORKDIR /repo
ARG APP_VERSION
ARG GIT_SHA
RUN --mount=type=bind,source=.git,target=/repo/.git,readonly \
    set -eu; \
    version="${APP_VERSION:-$(git describe --exact-match --tags HEAD)}"; \
    sha="${GIT_SHA:-$(git rev-parse HEAD)}"; \
    printf '{"version":"%s","sha":"%s"}\n' "$version" "$sha" > /version.json

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=release /version.json /usr/share/nginx/html/version.json
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
