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

# Keep dependency installation independent from application source changes.
COPY package.json package-lock.json .npmrc ./
COPY apps/vtt/package.json ./apps/vtt/package.json
COPY apps/vtt/apps/generator-hub/package.json ./apps/vtt/apps/generator-hub/package.json
COPY packages/character-contracts/package.json ./packages/character-contracts/package.json
COPY packages/character-creator/package.json ./packages/character-creator/package.json
COPY packages/character-creator/scripts ./packages/character-creator/scripts
COPY packages/document-contracts/package.json ./packages/document-contracts/package.json
COPY apps/vtt/patches ./apps/vtt/patches
COPY apps/vtt/scripts/apply-patches.js apps/vtt/scripts/sync-dice-assets.js apps/vtt/scripts/prepare-husky.js ./apps/vtt/scripts/

RUN npm ci \
    --workspace=nexus-vtt \
    --workspace=generator-hub \
    --workspace=@nexus/character-contracts \
    --workspace=@nexus/character-creator \
    --include-workspace-root \
    --legacy-peer-deps

COPY apps/vtt ./apps/vtt
COPY packages ./packages

ARG COMMIT_SHA=unknown
ARG VITE_DELTA_SYNC=false

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

COPY package.json package-lock.json ./
COPY apps/forge/package.json ./apps/forge/package.json
COPY packages/character-contracts/package.json ./packages/character-contracts/package.json
COPY packages/character-creator/package.json ./packages/character-creator/package.json
COPY packages/character-creator/scripts ./packages/character-creator/scripts
COPY packages/document-contracts/package.json ./packages/document-contracts/package.json

RUN npm ci \
    --workspace=nexus-forge \
    --workspace=@nexus/character-contracts \
    --workspace=@nexus/character-creator \
    --include-workspace-root \
    --legacy-peer-deps

COPY apps/forge ./apps/forge
COPY packages ./packages

RUN npm run build --workspace=@nexus/character-contracts && \
    npm run build --workspace=@nexus/character-creator && \
    npm run build --workspace=nexus-forge


# Stage 4: Codex DM UI Builder
FROM node:26.9.0-alpine AS codex-dm-builder

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/codex/services/dm-ui/package.json ./apps/codex/services/dm-ui/package.json

RUN npm ci \
    --workspace=@nexuscodex/dm-ui \
    --include-workspace-root \
    --legacy-peer-deps

COPY apps/codex/services/dm-ui ./apps/codex/services/dm-ui

RUN npm run build --workspace=@nexuscodex/dm-ui


# Stage 5: Codex Admin UI Builder
FROM node:26.9.0-alpine AS codex-admin-builder

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/codex/services/admin-ui/package.json ./apps/codex/services/admin-ui/package.json

RUN npm ci \
    --workspace=admin-ui \
    --include-workspace-root \
    --legacy-peer-deps

COPY apps/codex/services/admin-ui ./apps/codex/services/admin-ui

# Served at / on the private admin listener (:8081), never under the public
# VTT root. See apps/docs/platform/private-admin-control-plane.md.
ENV ADMIN_UI_BASE=/

RUN npm run build --workspace=admin-ui


# Stage 6: Unified Production Gateway
FROM nginx:alpine AS production

# Upgrade base OS packages and purge unused image-filter module and its dependencies (removes tiff CVEs)
RUN apk upgrade --no-cache && \
    apk del nginx-module-image-filter libgd tiff

COPY apps/vtt/docker/nginx.conf /etc/nginx/nginx.conf
COPY apps/vtt/docker/security-headers.conf /etc/nginx/security-headers.conf

# Copy built applications from builder stages
COPY --from=vtt-builder /workspace/apps/vtt/dist /usr/share/nginx/html
COPY --from=vtt-builder /workspace/apps/vtt/apps/generator-hub/dist /usr/share/nginx/html/generator-hub
COPY --from=forge-builder /workspace/apps/forge/dist /usr/share/nginx/html/forge
COPY --from=codex-dm-builder /workspace/apps/codex/services/dm-ui/dist /usr/share/nginx/html/codex-dm
# Root of the private admin listener (:8081): the Codex Admin UI. Deliberately
# outside the VTT root above, so neither listener can serve the other's files.
COPY --from=codex-admin-builder /workspace/apps/codex/services/admin-ui/dist /usr/share/nginx/admin-ui

ARG VERSION=dev
ARG COMMIT_SHA=unknown

LABEL org.opencontainers.image.title="Nexus Unified Frontend" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

# 80 is the public gateway. 8081 is the private admin listener: it is reached
# only over Docker networks by the edge proxy and must never be published on
# the host.
EXPOSE 80 8081

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
