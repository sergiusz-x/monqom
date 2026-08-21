# syntax=docker/dockerfile:1
FROM node:22-alpine AS dependencies
WORKDIR /app
ENV CI=true
RUN corepack enable pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY packages/ui/package.json ./packages/ui/
COPY backend/scripts ./backend/scripts
RUN pnpm install --frozen-lockfile
COPY backend/prisma ./backend/prisma
COPY backend/prisma.config.ts ./backend/
WORKDIR /app/backend
RUN pnpm exec prisma generate

FROM dependencies AS production-dependencies
WORKDIR /app
RUN pnpm --filter backend deploy --prod /prod/backend
WORKDIR /prod/backend
RUN /app/backend/node_modules/.bin/prisma generate --schema /prod/backend/prisma/schema.prisma \
    && node -e "require('@prisma/client')"

FROM dependencies AS build
WORKDIR /app
COPY backend/nest-cli.json backend/tsconfig.json backend/tsconfig.build.json ./backend/
COPY backend/src ./backend/src
COPY packages/ui ./packages/ui
WORKDIR /app/backend
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
    printf "APP_VERSION='%s'\nGIT_SHA='%s'\n" "$version" "$sha" > /release.env

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx \
    && addgroup -S monqom \
    && adduser -S monqom -G monqom
COPY --from=production-dependencies /prod/backend/node_modules ./backend/node_modules
COPY backend/prisma ./backend/prisma
COPY backend/prisma.config.ts ./backend/
WORKDIR /app
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=release /release.env ./backend/release.env
RUN node -e "require('./backend/node_modules/@prisma/client')"
USER monqom
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "require('http').get('http://127.0.0.1:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
WORKDIR /app/backend
CMD ["sh", "-c", "set -a; . ./release.env; set +a; exec node dist/main"]

FROM node:22-alpine AS migration
WORKDIR /app/backend
ENV NODE_ENV=production
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx \
    && addgroup -S monqom \
    && adduser -S monqom -G monqom
COPY --from=production-dependencies /prod/backend/node_modules ./node_modules
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./
COPY backend/scripts/migrate-with-retry.sh ./scripts/migrate-with-retry.sh
RUN sed -i 's/\r$//' ./scripts/migrate-with-retry.sh
USER monqom
CMD ["sh", "./scripts/migrate-with-retry.sh"]
