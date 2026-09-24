# Nexus control-api. Build from the repository root:
#   docker build -f apps/control-api/Dockerfile .
# Pin the Node.js patch (the runtime ships in the final image).
FROM node:26.9.0-alpine AS base
WORKDIR /app

# Full dependency install for the TypeScript build.
FROM base AS build
COPY package.json package-lock.json .npmrc ./
COPY apps/control-api/package.json ./apps/control-api/package.json
RUN npm ci --workspace=nexus-control-api --include-workspace-root --ignore-scripts
COPY apps/control-api/tsconfig.json apps/control-api/tsconfig.build.json ./apps/control-api/
COPY apps/control-api/src ./apps/control-api/src
RUN npm run build --workspace=nexus-control-api

# Production dependencies only.
FROM base AS prod-deps
COPY package.json package-lock.json .npmrc ./
COPY apps/control-api/package.json ./apps/control-api/package.json
RUN npm ci --omit=dev --workspace=nexus-control-api --include-workspace-root --ignore-scripts && \
    mkdir -p apps/control-api/node_modules

FROM base AS runner
ENV NODE_ENV=production \
    PORT=4000
RUN apk upgrade --no-cache && \
    apk add --no-cache dumb-init && \
    addgroup -g 1001 -S nodejs && \
    adduser -S control -u 1001 -G nodejs
COPY --from=prod-deps --chown=root:root /app/node_modules ./node_modules
COPY --from=prod-deps --chown=root:root /app/apps/control-api/node_modules ./apps/control-api/node_modules
COPY --from=build --chown=root:root /app/apps/control-api/dist ./apps/control-api/dist
COPY --chown=root:root apps/control-api/package.json ./apps/control-api/package.json
COPY --chown=root:root package.json ./package.json

# Code is root-owned and read-only to the runtime user.
USER control
WORKDIR /app/apps/control-api
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 4000) + '/healthz', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ARG VERSION=dev
ARG COMMIT_SHA=unknown
LABEL org.opencontainers.image.title="Nexus Control API" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

ENTRYPOINT ["dumb-init", "--"]
# Bootstrap: docker compose run --rm control-api node dist/cli.js grant-role --email <email> --role platform_admin
CMD ["node", "dist/server.js"]
