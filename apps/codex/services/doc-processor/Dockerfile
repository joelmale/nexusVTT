FROM node:26.5.0-bookworm-slim AS base

# Install build dependencies for native modules (canvas, sharp) and OpenSSL for Prisma
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    pkg-config \
    libc6-dev \
    libjpeg-dev \
    libpng-dev \
    libgif-dev \
    libpango1.0-dev \
    libcairo2-dev \
    libpixman-1-dev \
    libpangomm-1.4-dev \
    libfreetype6-dev \
    libssl-dev \
    git && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/codex/services/doc-processor/package.json ./apps/codex/services/doc-processor/
RUN npm ci --workspace=nexus-codex-doc-processor --include-workspace-root

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
# Dependencies that could not hoist (bullmq@5 here, because doc-api pins
# bullmq@4 at the root) install into the workspace's own node_modules.
# Copying only /app/node_modules silently drops them.
COPY --from=deps /app/apps/codex/services/doc-processor/node_modules ./apps/codex/services/doc-processor/node_modules
COPY . .

RUN npm run prisma:generate --workspace=nexus-codex-doc-processor && \
    npm run build --workspace=nexus-codex-doc-processor

# Production image, copy all the files and run
FROM base AS runner
WORKDIR /app

ARG VERSION=dev
ARG COMMIT_SHA=unknown

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker

# Copy necessary files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/codex/services/doc-processor/node_modules ./apps/codex/services/doc-processor/node_modules
COPY --from=builder /app/apps/codex/services/doc-processor/dist ./apps/codex/services/doc-processor/dist
COPY --from=builder /app/apps/codex/services/doc-processor/prisma ./apps/codex/services/doc-processor/prisma
COPY --from=builder /app/apps/codex/services/doc-processor/package.json ./apps/codex/services/doc-processor/package.json
COPY --from=builder /app/package.json ./package.json

# Change ownership
RUN chown -R worker:nodejs /app

USER worker
WORKDIR /app/apps/codex/services/doc-processor

LABEL org.opencontainers.image.title="Nexus Codex Document Processor" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

# Start the worker
CMD ["node", "dist/index.js"]
