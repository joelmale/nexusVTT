# syntax=docker/dockerfile:1

FROM node:26.5.0-alpine AS builder

WORKDIR /workspace

# npm workspaces share the repository-root lockfile. Keep manifests in a
# separate layer so dependency installation remains cacheable.
COPY package.json package-lock.json ./
COPY apps/forge/package.json ./apps/forge/
COPY packages/character-contracts/package.json ./packages/character-contracts/
COPY packages/document-contracts/package.json ./packages/document-contracts/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=nexus-forge --include-workspace-root

COPY apps/forge ./apps/forge
COPY packages ./packages

RUN --mount=type=cache,target=/workspace/node_modules/.vite \
    npm run build --workspace=nexus-forge

FROM cgr.dev/chainguard/nginx:latest

ARG VERSION=dev
ARG COMMIT_SHA=unknown

COPY apps/forge/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/forge/dist /usr/share/nginx/html

LABEL org.opencontainers.image.title="Nexus Forge" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

EXPOSE 8080
