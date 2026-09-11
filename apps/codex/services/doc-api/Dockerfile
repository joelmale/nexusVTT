FROM node:22-alpine AS base

# Install OpenSSL for Prisma and git for SRD import
RUN apk add --no-cache openssl git

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
# Force rebuild v3
RUN echo "Force rebuild at $(date)"
COPY --from=deps /app/node_modules ./node_modules
COPY package.json .
COPY tsconfig.json .
COPY prisma ./prisma
COPY src ./src

# Production image, copy all the files and run
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fastify

# Copy necessary files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Change ownership
RUN chown -R fastify:nodejs /app

USER fastify

EXPOSE 3000

# Run database migrations and start server
CMD ["sh", "-c", "npx prisma generate && npx prisma db push --skip-generate && npx tsx src/server.ts"]
