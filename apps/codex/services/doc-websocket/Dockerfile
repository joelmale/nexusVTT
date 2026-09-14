# Build stage
FROM node:22-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/codex/services/doc-websocket/package.json ./apps/codex/services/doc-websocket/

RUN npm ci --workspace=nexus-codex-doc-websocket --include-workspace-root

COPY apps/codex/services/doc-websocket/package.json ./apps/codex/services/doc-websocket/
COPY apps/codex/services/doc-websocket/tsconfig.json ./apps/codex/services/doc-websocket/
COPY apps/codex/services/doc-websocket/prisma ./apps/codex/services/doc-websocket/prisma
COPY apps/codex/services/doc-websocket/src ./apps/codex/services/doc-websocket/src

RUN npm run prisma:generate --workspace=nexus-codex-doc-websocket && \
    npm run build --workspace=nexus-codex-doc-websocket

# Production stage
FROM node:22-alpine

ARG VERSION=dev
ARG COMMIT_SHA=unknown

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/codex/services/doc-websocket/package.json ./apps/codex/services/doc-websocket/package.json
COPY --from=builder /app/apps/codex/services/doc-websocket/dist ./apps/codex/services/doc-websocket/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/apps/codex/services/doc-websocket/prisma ./apps/codex/services/doc-websocket/prisma

# Set environment
ENV NODE_ENV=production

# Expose WebSocket port
EXPOSE 3002

LABEL org.opencontainers.image.title="Nexus Codex Document WebSocket" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

WORKDIR /app/apps/codex/services/doc-websocket

CMD ["node", "dist/index.js"]
