# syntax=docker/dockerfile:1
FROM node:22-alpine AS dependencies
WORKDIR /app
RUN corepack enable pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY packages/ui/package.json ./packages/ui/
COPY backend/scripts ./backend/scripts
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
WORKDIR /app
COPY backend/prisma ./backend/prisma
COPY backend/prisma.config.ts backend/nest-cli.json backend/tsconfig.json backend/tsconfig.build.json ./backend/
COPY backend/src ./backend/src
COPY packages/ui ./packages/ui
WORKDIR /app/backend
RUN npx prisma generate && pnpm run build

FROM node:22-alpine AS release
RUN apk add --no-cache git
WORKDIR /repo
ARG APP_VERSION
ARG GIT_SHA
RUN --mount=type=bind,source=.git,target=/repo/.git,readonly \
    set -eu; \
    version="${APP_VERSION:-$(git describe --exact-match --tags HEAD)}"; \
    sha="${GIT_SHA:-$(git rev-parse HEAD)}"; \
    printf "APP_VERSION='%s'\nGIT_SHA='%s'\n" "$version" "$sha" > /release.env

FROM node:22-alpine AS runtime
WORKDIR /app
RUN corepack enable pnpm
ENV NODE_ENV=production
RUN addgroup -S monqom && adduser -S monqom -G monqom
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/backend/node_modules/.prisma ./backend/node_modules/.prisma
COPY --from=build /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=release /release.env ./backend/release.env
USER monqom
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "require('http').get('http://127.0.0.1:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
WORKDIR /app/backend
CMD ["sh", "-c", "set -a; . ./release.env; set +a; exec node dist/main"]

FROM build AS migration
WORKDIR /app/backend
ENV NODE_ENV=production
RUN addgroup -S monqom && adduser -S monqom -G monqom
USER monqom
CMD ["sh", "./scripts/migrate-with-retry.sh"]
