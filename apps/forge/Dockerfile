# syntax=docker/dockerfile:1

FROM node:26.9.0-alpine AS builder

WORKDIR /workspace

# npm workspaces share the repository-root lockfile. Keep manifests in a
# separate layer so dependency installation remains cacheable.
COPY package.json package-lock.json ./
COPY apps/forge/package.json ./apps/forge/
COPY packages/character-contracts/package.json ./packages/character-contracts/
COPY packages/game-contracts/package.json ./packages/game-contracts/
COPY packages/character-creator/package.json ./packages/character-creator/
# The creator's `prepare` hook runs during install, so its build script has to
# exist by then. It no-ops until the style sources arrive with the COPY below.
COPY packages/character-creator/scripts ./packages/character-creator/scripts
COPY packages/document-contracts/package.json ./packages/document-contracts/

# Forge compiles the shared character creator from source, so that workspace's
# own dependencies must be installed as well — Forge's nested copies under
# apps/forge/node_modules are not resolvable from packages/.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=nexus-forge --workspace=@nexus/character-creator --workspace=@nexus/game-contracts \
    --include-workspace-root

COPY apps/forge ./apps/forge
COPY packages ./packages

# The creator depends on the shared character contract, so that package's
# declaration output has to exist before Forge's bundle resolves it.
RUN --mount=type=cache,target=/workspace/node_modules/.vite \
    npm run build --workspace=@nexus/character-contracts \
    && npm run build --workspace=@nexus/game-contracts \
    && npm run build --workspace=@nexus/character-creator \
    && npm run build --workspace=nexus-forge

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
