# syntax=docker/dockerfile:1
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
COPY backend/scripts ./scripts
RUN npm ci

FROM dependencies AS build
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts backend/nest-cli.json backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN npx prisma generate && npm run build

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
ENV NODE_ENV=production
RUN addgroup -S monqom && adduser -S monqom -G monqom
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY --from=release /release.env ./release.env
USER monqom
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "require('http').get('http://127.0.0.1:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["sh", "-c", "set -a; . ./release.env; set +a; exec node dist/main"]

FROM build AS migration
ENV NODE_ENV=production
RUN addgroup -S monqom && adduser -S monqom -G monqom
USER monqom
CMD ["sh", "./scripts/migrate-with-retry.sh"]
