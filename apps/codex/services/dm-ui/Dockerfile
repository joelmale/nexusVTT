# Build stage
FROM node:26.9.0-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/codex/services/dm-ui/package.json ./apps/codex/services/dm-ui/

RUN npm ci --workspace=@nexuscodex/dm-ui --include-workspace-root

COPY apps/codex/services/dm-ui ./apps/codex/services/dm-ui

RUN npm run build --workspace=@nexuscodex/dm-ui

# Production stage
FROM nginx:alpine

ARG VERSION=dev
ARG COMMIT_SHA=unknown

# Copy built assets from builder
COPY --from=builder /app/apps/codex/services/dm-ui/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/codex/services/dm-ui/nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint for runtime config
COPY apps/codex/services/dm-ui/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

LABEL org.opencontainers.image.title="Nexus Codex DM UI" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

# Start nginx
CMD ["/docker-entrypoint.sh"]
