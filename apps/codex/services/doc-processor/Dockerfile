FROM node:22-bookworm-slim AS base

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
RUN npm ci --workspace=apps/codex/services/doc-processor --include-workspace-root

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

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
COPY --from=builder /app/apps/codex/services/doc-processor/dist ./apps/codex/services/doc-processor/dist
COPY --from=builder /app/apps/codex/services/doc-processor/prisma ./apps/codex/services/doc-processor/prisma
COPY --from=builder /app/package.json ./package.json

# Change ownership
RUN chown -R worker:nodejs /app

USER worker

LABEL org.opencontainers.image.title="Nexus Codex Document Processor" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

# Start the worker
CMD ["node", "dist/index.js"]
