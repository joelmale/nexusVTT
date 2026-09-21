# Multi-stage Dockerfile for Nexus Unified Frontend Gateway

# Stage 1: Development
FROM node:26.9.0-alpine AS development

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/vtt ./apps/vtt
COPY packages ./packages

RUN npm ci \
    --workspace=nexus-vtt \
    --workspace=generator-hub \
    --workspace=@nexus/character-contracts \
    --workspace=@nexus/character-creator \
    --include-workspace-root \
    --legacy-peer-deps

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace=nexus-vtt", "--", "--host", "0.0.0.0"]


# Stage 2: VTT Builder
FROM node:26.9.0-alpine AS vtt-builder

WORKDIR /workspace

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
    --workspace=@nexus/character-creator \
    --include-workspace-root \
    --legacy-peer-deps

# Short commit SHA → lobby build badge matches the GitHub commit.
ENV VITE_BUILD_VERSION=$COMMIT_SHA
ENV VITE_DELTA_SYNC=$VITE_DELTA_SYNC

RUN npm run build --workspace=@nexus/character-contracts && \
    npm run build --workspace=@nexus/character-creator && \
    npm run build --workspace=nexus-vtt && \
    npm run build --workspace=generator-hub


# Stage 3: Forge Builder
FROM node:26.9.0-alpine AS forge-builder

WORKDIR /workspace

ARG VERSION=dev
ARG COMMIT_SHA=unknown

COPY package.json package-lock.json ./
COPY apps/forge ./apps/forge
COPY packages ./packages

RUN npm ci \
    --workspace=nexus-forge \
    --workspace=@nexus/character-contracts \
    --workspace=@nexus/character-creator \
    --include-workspace-root \
    --legacy-peer-deps

RUN npm run build --workspace=@nexus/character-contracts && \
    npm run build --workspace=@nexus/character-creator && \
    npm run build --workspace=nexus-forge


# Stage 4: Codex DM UI Builder
FROM node:26.9.0-alpine AS codex-dm-builder

WORKDIR /workspace

ARG VERSION=dev
ARG COMMIT_SHA=unknown

COPY package.json package-lock.json ./
COPY apps/codex/services/dm-ui ./apps/codex/services/dm-ui

RUN npm ci \
    --workspace=@nexuscodex/dm-ui \
    --include-workspace-root \
    --legacy-peer-deps

RUN npm run build --workspace=@nexuscodex/dm-ui


# Stage 5: Codex Admin UI Builder
FROM node:26.9.0-alpine AS codex-admin-builder

WORKDIR /workspace

ARG VERSION=dev
ARG COMMIT_SHA=unknown

COPY package.json package-lock.json ./
COPY apps/codex/services/admin-ui ./apps/codex/services/admin-ui

RUN npm ci \
    --workspace=admin-ui \
    --include-workspace-root \
    --legacy-peer-deps

RUN npm run build --workspace=admin-ui


# Stage 6: Unified Production Gateway
FROM nginx:alpine AS production

ARG VERSION=dev
ARG COMMIT_SHA=unknown

COPY apps/vtt/docker/nginx.conf /etc/nginx/nginx.conf
COPY apps/vtt/docker/security-headers.conf /etc/nginx/security-headers.conf

# Copy built applications from builder stages
COPY --from=vtt-builder /workspace/apps/vtt/dist /usr/share/nginx/html
COPY --from=vtt-builder /workspace/apps/vtt/apps/generator-hub/dist /usr/share/nginx/html/generator-hub
COPY --from=forge-builder /workspace/apps/forge/dist /usr/share/nginx/html/forge
COPY --from=codex-dm-builder /workspace/apps/codex/services/dm-ui/dist /usr/share/nginx/html/codex-dm
COPY --from=codex-admin-builder /workspace/apps/codex/services/admin-ui/dist /usr/share/nginx/html/codex-admin

LABEL org.opencontainers.image.title="Nexus Unified Frontend" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
