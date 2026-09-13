# Build stage
FROM node:22-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/codex/services/doc-websocket/tsconfig.json ./apps/codex/services/doc-websocket//

# Install dependencies
RUN npm ci --workspace=apps/codex/services/doc-websocket --include-workspace-root

# Copy source code
COPY apps/codex/services/doc-websocket/src ./apps/codex/services/doc-websocket/src

# Copy the service's canonical Prisma schema
COPY prisma/schema.prisma ./prisma/schema.prisma

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:22-alpine

ARG VERSION=dev
ARG COMMIT_SHA=unknown

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --workspace=apps/codex/services/doc-websocket --include-workspace-root --omit=dev

# Copy built application and Prisma files from builder
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

# Run the application
CMD ["node", "dist/index.js"]
