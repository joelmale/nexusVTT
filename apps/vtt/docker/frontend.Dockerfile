# Multi-stage Dockerfile for Nexus VTT Frontend

# Stage 1: Development
FROM node:26.5.0-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY services/asset-service/package.json ./services/asset-service/package.json
COPY apps/generator-hub/package.json ./apps/generator-hub/package.json
COPY patches ./patches
COPY scripts/sync-dice-assets.js ./scripts/sync-dice-assets.js
COPY scripts/prepare-husky.js ./scripts/prepare-husky.js

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start development server with hot reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


# Stage 2: Builder
FROM node:26.5.0-alpine AS builder

WORKDIR /app

# Build metadata
ARG VERSION=dev
ARG COMMIT_SHA=unknown
ARG VITE_DELTA_SYNC=false

# Copy package files
COPY package*.json ./
COPY services/asset-service/package.json ./services/asset-service/package.json
COPY apps/generator-hub/package.json ./apps/generator-hub/package.json
COPY patches ./patches
COPY scripts/sync-dice-assets.js ./scripts/sync-dice-assets.js
COPY scripts/prepare-husky.js ./scripts/prepare-husky.js

# Install all dependencies (needed for build)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Short commit SHA → lobby build badge matches the GitHub commit.
ENV VITE_BUILD_VERSION=$COMMIT_SHA
ENV VITE_DELTA_SYNC=$VITE_DELTA_SYNC

# Build the application
RUN npm run build && npm run build:generator-hub


# Stage 3: Production
FROM nginx:alpine AS production

COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/apps/generator-hub/dist /usr/share/nginx/html/generator-hub

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
