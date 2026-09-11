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

COPY package.json package-lock.json* ./
RUN npm ci

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

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker

# Copy necessary files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Change ownership
RUN chown -R worker:nodejs /app

USER worker

# Start the worker
CMD ["node", "dist/index.js"]
