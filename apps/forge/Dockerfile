# syntax=docker/dockerfile:1
# Multi-stage Docker build optimized for speed
# - Uses BuildKit cache mounts for npm and Vite
# - Copies files in layers for better caching
# - Excludes unnecessary files via .dockerignore

# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and configs first for better caching
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY postcss.config.js ./

# Install dependencies with cache mount for faster builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci && \
    npm cache clean --force

# Copy source code in smaller chunks for better layer caching
COPY src ./src/
COPY public ./public/
COPY index.html ./

# Build with cache mount
RUN --mount=type=cache,target=/app/node_modules/.vite \
    npm run build

# Stage 2: Serve with Nginx (Distroless)
FROM cgr.dev/chainguard/nginx:latest

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 8080 (unprivileged)
EXPOSE 8080
