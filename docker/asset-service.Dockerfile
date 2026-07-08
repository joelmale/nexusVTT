# Dockerfile for the standalone Nexus VTT asset service

FROM node:26-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY services/asset-service/package*.json ./
RUN npm ci

COPY services/asset-service/tsconfig.json ./tsconfig.json
COPY services/asset-service/src ./src
RUN npm run build && npm prune --omit=dev

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

CMD ["sh", "-c", "node /app/scripts/ensure-library-assets.cjs --source \"$ASSET_SEED_SOURCE\" --target \"$LIBRARY_DATA_PATH\" && npm start"]
