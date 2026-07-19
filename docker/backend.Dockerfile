# Dockerfile for Nexus VTT Backend WebSocket Server

FROM node:26.5.0-alpine

# Set working directory
WORKDIR /app

# Install runtime tools and create the non-root build/runtime user up front.
RUN apk add --no-cache dumb-init curl netcat-openbsd postgresql-client && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown nodejs:nodejs /app

# Copy package files
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs tsconfig*.json ./
COPY --chown=nodejs:nodejs patches ./patches
COPY --chown=nodejs:nodejs scripts/sync-dice-assets.js ./scripts/sync-dice-assets.js

USER nodejs

# Install dependencies
RUN npm ci

# Copy server and shared code
COPY --chown=nodejs:nodejs server/ ./server/
COPY --chown=nodejs:nodejs shared/ ./shared/

# Build the server
RUN npm run build:server

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
