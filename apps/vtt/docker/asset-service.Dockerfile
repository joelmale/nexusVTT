# Dockerfile for the standalone Nexus VTT asset service

FROM node:26.9.0-alpine

WORKDIR /workspace

RUN apk add --no-cache dumb-init

COPY package.json package-lock.json .npmrc ./
COPY apps/vtt/services/asset-service/package.json ./apps/vtt/services/asset-service/package.json
COPY apps/vtt/patches ./apps/vtt/patches

RUN npm ci --workspace=asset-service --include-workspace-root --legacy-peer-deps

# Run from /workspace, the WORKDIR: patch-package rejects an absolute
# --patch-dir, and it resolves packages relative to its cwd -- parseurl is
# hoisted to /workspace/node_modules, not the service's own tree, so
# `npm exec --workspace=asset-service` would look in the wrong place.
RUN npx patch-package --patch-dir apps/vtt/patches

COPY apps/vtt/services/asset-service/tsconfig.json ./apps/vtt/services/asset-service/tsconfig.json
COPY apps/vtt/services/asset-service/src ./apps/vtt/services/asset-service/src
COPY apps/vtt/shared ./apps/vtt/shared
RUN npm run build --workspace asset-service && npm prune --omit=dev --workspace asset-service

COPY apps/vtt/scripts/ensure-library-assets.cjs ./apps/vtt/scripts/ensure-library-assets.cjs

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /workspace/static-assets/assets /workspace/static-assets/users /workspace/assets-data && \
    chown -R nodejs:nodejs /workspace

USER nodejs
WORKDIR /workspace

ENV PORT=5003
ENV ASSETS_PATH=/workspace/static-assets
ENV LIBRARY_DATA_PATH=/workspace/assets-data
ENV LIBRARY_MANIFEST_PATH=/workspace/assets-data/manifests/manifest-v2.json
ENV ASSET_SEED_SOURCE=/seed/tmt

EXPOSE 5003

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const port = process.env.PORT || 5003; require('http').get('http://127.0.0.1:' + port + '/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]

ARG VERSION=dev
ARG COMMIT_SHA=unknown

LABEL org.opencontainers.image.title="Nexus VTT Asset Service" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

CMD ["sh", "-c", "node /workspace/apps/vtt/scripts/ensure-library-assets.cjs --source \"$ASSET_SEED_SOURCE\" --target \"$LIBRARY_DATA_PATH\" && npm start --workspace=asset-service"]
