# Dockerfile for Nexus VTT Backend WebSocket Server

FROM node:25-alpine

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling and netcat for readiness checks
RUN apk add --no-cache dumb-init curl netcat-openbsd postgresql-client

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

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

# Expose WebSocket port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "const port = process.env.PORT || 5000; require('http').get('http://localhost:' + port + '/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the built server
CMD ["npm", "run", "server:start"]
