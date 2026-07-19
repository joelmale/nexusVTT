# Dockerfile for Nexus VTT Backend WebSocket Server

FROM node:26.5.0-alpine

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling and netcat for readiness checks
RUN apk add --no-cache dumb-init curl netcat-openbsd postgresql-client

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY patches ./patches
COPY scripts/sync-dice-assets.js ./scripts/sync-dice-assets.js

# Install dependencies
RUN npm ci

# Copy server and shared code
COPY server/ ./server/
COPY shared/ ./shared/

# Build the server
RUN npm run build:server

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Default port — must match the server default (index.ts) and the health check below.
# Override with PORT env var in docker-compose / Dockhand environment.
ENV PORT=5001

# Expose WebSocket port
EXPOSE 5001

# Health check
# start-period must cover the postgres+redis wait loop before npm starts (~30-60s)
# 127.0.0.1 is explicit to avoid Node.js v17+ resolving localhost to ::1 (IPv6) first
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "const port = process.env.PORT || 5000; require('http').get('http://127.0.0.1:' + port + '/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the built server
CMD ["npm", "run", "server:start"]
