FROM node:26.9.0-alpine AS base

# Install OpenSSL for Prisma and git for SRD import
RUN apk add --no-cache openssl git

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy root and participating workspace manifests.
COPY package.json package-lock.json ./
COPY apps/codex/services/doc-api/package.json ./apps/codex/services/doc-api/
COPY packages/document-contracts/package.json ./packages/document-contracts/

RUN npm ci \
    --workspace=nexus-codex-doc-api \
    --workspace=@nexus/document-contracts \
    --include-workspace-root

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/codex/services/doc-api/package.json ./apps/codex/services/doc-api/
COPY apps/codex/services/doc-api/tsconfig.json ./apps/codex/services/doc-api/
COPY apps/codex/services/doc-api/prisma ./apps/codex/services/doc-api/prisma
COPY apps/codex/services/doc-api/src ./apps/codex/services/doc-api/src
COPY packages/document-contracts ./packages/document-contracts

RUN npm run build --workspace=@nexus/document-contracts && \
    npm run prisma:generate --workspace=nexus-codex-doc-api && \
    npm run build --workspace=nexus-codex-doc-api

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
COPY --from=builder /app/apps/codex/services/doc-api/dist ./apps/codex/services/doc-api/dist
COPY --from=builder /app/apps/codex/services/doc-api/prisma ./apps/codex/services/doc-api/prisma
COPY --from=builder /app/apps/codex/services/doc-api/package.json ./apps/codex/services/doc-api/package.json
COPY --from=builder /app/packages/document-contracts ./packages/document-contracts
COPY --from=builder /app/package.json ./package.json

# Change ownership
RUN chown -R fastify:nodejs /app

USER fastify
WORKDIR /app/apps/codex/services/doc-api

EXPOSE 3000

LABEL org.opencontainers.image.title="Nexus Codex Document API" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

# Run database migrations and start the compiled server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
