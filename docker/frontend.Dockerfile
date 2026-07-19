# Multi-stage Dockerfile for Nexus VTT Frontend

# Stage 1: Development
FROM node:26.5.0-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY patches ./patches
COPY scripts/sync-dice-assets.js ./scripts/sync-dice-assets.js

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

# Copy package files
COPY package*.json ./
COPY patches ./patches
COPY scripts/sync-dice-assets.js ./scripts/sync-dice-assets.js

# Install all dependencies (needed for build)
RUN npm ci

# Copy source code
COPY . .

# Short commit SHA → lobby build badge matches the GitHub commit.
ENV VITE_BUILD_VERSION=$COMMIT_SHA

# Build the application
RUN npm run build


# Stage 3: Production
FROM nginx:alpine AS production

COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
