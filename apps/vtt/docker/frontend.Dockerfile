# Multi-stage Dockerfile for Nexus VTT Frontend

# Stage 1: Development
FROM node:26.5.0-alpine AS development

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/vtt ./apps/vtt
COPY packages ./packages

RUN npm ci \
    --workspace=nexus-vtt \
    --workspace=generator-hub \
    --workspace=@nexus/character-contracts \
    --include-workspace-root \
    --legacy-peer-deps

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace=nexus-vtt", "--", "--host", "0.0.0.0"]


# Stage 2: Builder
FROM node:26.5.0-alpine AS builder

WORKDIR /workspace

# Build metadata
ARG VERSION=dev
ARG COMMIT_SHA=unknown
ARG VITE_DELTA_SYNC=false

COPY package.json package-lock.json ./
COPY apps/vtt ./apps/vtt
COPY packages ./packages

RUN npm ci \
    --workspace=nexus-vtt \
    --workspace=generator-hub \
    --workspace=@nexus/character-contracts \
    --include-workspace-root \
    --legacy-peer-deps

# Short commit SHA → lobby build badge matches the GitHub commit.
ENV VITE_BUILD_VERSION=$COMMIT_SHA
ENV VITE_DELTA_SYNC=$VITE_DELTA_SYNC

RUN npm run build --workspace=@nexus/character-contracts && \
    npm run build --workspace=nexus-vtt && \
    npm run build --workspace=generator-hub


# Stage 3: Production
FROM nginx:alpine AS production

ARG VERSION=dev
ARG COMMIT_SHA=unknown

COPY apps/vtt/docker/nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder stage
COPY --from=builder /workspace/apps/vtt/dist /usr/share/nginx/html
COPY --from=builder /workspace/apps/vtt/apps/generator-hub/dist /usr/share/nginx/html/generator-hub

LABEL org.opencontainers.image.title="Nexus VTT Frontend" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
