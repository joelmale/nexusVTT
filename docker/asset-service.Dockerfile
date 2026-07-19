# Dockerfile for the standalone Nexus VTT asset service

FROM node:26.5.0-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY package*.json ./
COPY services/asset-service/package.json ./services/asset-service/package.json
# A workspace-scoped install still invokes the root lifecycle in npm 11. The
# root postinstall tooling is intentionally absent from this production image,
# so suppress lifecycle scripts here and apply the shared runtime patch
# explicitly after installation.
RUN npm ci --workspace asset-service --include-workspace-root=false --ignore-scripts

COPY patches ./patches
RUN npm exec -- patch-package

COPY services/asset-service/tsconfig.json ./services/asset-service/tsconfig.json
COPY services/asset-service/src ./services/asset-service/src
COPY shared ./shared
RUN npm run build --workspace asset-service && npm prune --omit=dev --workspace asset-service

COPY scripts/ensure-library-assets.cjs ./scripts/ensure-library-assets.cjs

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/static-assets/assets /app/static-assets/users /app/assets-data && \
    chown -R nodejs:nodejs /app

USER nodejs

ENV PORT=5003
ENV ASSETS_PATH=/app/static-assets
ENV LIBRARY_DATA_PATH=/app/assets-data
ENV LIBRARY_MANIFEST_PATH=/app/assets-data/manifests/manifest-v2.json
ENV ASSET_SEED_SOURCE=/seed/tmt

EXPOSE 5003

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const port = process.env.PORT || 5003; require('http').get('http://127.0.0.1:' + port + '/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]

CMD ["sh", "-c", "node /app/scripts/ensure-library-assets.cjs --source \"$ASSET_SEED_SOURCE\" --target \"$LIBRARY_DATA_PATH\" && npm start --workspace asset-service"]
