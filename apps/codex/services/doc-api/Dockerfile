FROM node:22-alpine AS base

# Install OpenSSL for Prisma and git for SRD import
RUN apk add --no-cache openssl git

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
# Copy root package files
COPY package.json package-lock.json ./
# Copy all workspace package.json files to preserve workspace structure for npm ci
COPY apps/vtt/package.json ./apps/vtt/
COPY apps/vtt/apps/generator-hub/package.json ./apps/vtt/apps/generator-hub/
COPY apps/vtt/services/asset-service/package.json ./apps/vtt/services/asset-service/
COPY apps/forge/package.json ./apps/forge/
COPY apps/codex/services/admin-ui/package.json ./apps/codex/services/admin-ui/
COPY apps/codex/services/dm-ui/package.json ./apps/codex/services/dm-ui/
COPY apps/codex/services/doc-api/package.json ./apps/codex/services/doc-api/
COPY apps/codex/services/doc-processor/package.json ./apps/codex/services/doc-processor/
COPY apps/codex/services/doc-websocket/package.json ./apps/codex/services/doc-websocket/
COPY apps/codex/docs/package.json ./apps/codex/docs/

# Install dependencies
RUN npm ci --workspace=apps/codex/services/doc-api --include-workspace-root

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
# Force rebuild v3
RUN echo "Force rebuild at $(date)"
COPY --from=deps /app/node_modules ./node_modules
# Copy root package files
COPY package.json package-lock.json ./
# Copy all workspace package.json files to preserve workspace structure for npm ci
COPY apps/vtt/package.json ./apps/vtt/
COPY apps/vtt/apps/generator-hub/package.json ./apps/vtt/apps/generator-hub/
COPY apps/vtt/services/asset-service/package.json ./apps/vtt/services/asset-service/
COPY apps/forge/package.json ./apps/forge/
COPY apps/codex/services/admin-ui/package.json ./apps/codex/services/admin-ui/
COPY apps/codex/services/dm-ui/package.json ./apps/codex/services/dm-ui/
COPY apps/codex/services/doc-api/package.json ./apps/codex/services/doc-api/
COPY apps/codex/services/doc-processor/package.json ./apps/codex/services/doc-processor/
COPY apps/codex/services/doc-websocket/package.json ./apps/codex/services/doc-websocket/
COPY apps/codex/docs/package.json ./apps/codex/docs/
COPY apps/codex/services/doc-api/tsconfig.json ./apps/codex/services/doc-api/
COPY apps/codex/services/doc-api/prisma ./apps/codex/services/doc-api/prisma
RUN npx prisma generate
COPY apps/codex/services/doc-api/src ./apps/codex/services/doc-api/src

# Production image, copy all the files and run
FROM base AS runner
WORKDIR /app

ARG VERSION=dev
ARG COMMIT_SHA=unknown

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fastify

# Copy necessary files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/codex/services/doc-api/src ./apps/codex/services/doc-api/src
COPY --from=builder /app/apps/codex/services/doc-api/prisma ./apps/codex/services/doc-api/prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/codex/services/doc-api/tsconfig.json ./apps/codex/services/doc-api/tsconfig.json

# Change ownership
RUN chown -R fastify:nodejs /app

USER fastify
WORKDIR /app/apps/codex/services/doc-api

EXPOSE 3000

LABEL org.opencontainers.image.title="Nexus Codex Document API" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

# Run database migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx apps/codex/services/doc-api/src/server.ts"]
