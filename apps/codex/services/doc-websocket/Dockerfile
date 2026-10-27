# Build stage
FROM node:26.11.1-alpine AS builder

# Install OpenSSL for Prisma
# APK_REFRESH keys the apk layers to the calendar week (CI passes it), so a
# cached "apk add" layer cannot keep shipping packages that have since been
# fixed. Docker keys layers on the command text, not on the Alpine repository.
ARG APK_REFRESH=unset
RUN echo "apk refresh: $APK_REFRESH" && apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/codex/services/doc-websocket/package.json ./apps/codex/services/doc-websocket/

RUN npm ci --workspace=nexus-codex-doc-websocket --include-workspace-root

COPY apps/codex/services/doc-websocket/package.json ./apps/codex/services/doc-websocket/
COPY apps/codex/services/doc-websocket/tsconfig.json ./apps/codex/services/doc-websocket/
COPY apps/codex/services/doc-websocket/prisma ./apps/codex/services/doc-websocket/prisma
COPY apps/codex/services/doc-websocket/src ./apps/codex/services/doc-websocket/src

RUN npm run prisma:generate --workspace=nexus-codex-doc-websocket && \
    npm run build --workspace=nexus-codex-doc-websocket

# Production stage
FROM node:26.11.1-alpine

# npm's own bundled undici/brace-expansion carry High advisories (Trivy
# --ignore-unfixed) that even the latest npm release still ships. Swap in patched
# copies of the same major so the scanned runtime image is clean.
# APK_REFRESH keys this layer to the calendar week (CI passes it): Docker keys
# layers on the command text, so without it a cached layer keeps the undici
# that was current when it was built.
ARG APK_REFRESH=unset
RUN echo "npm patch refresh: $APK_REFRESH"; set -e; cd /tmp; N=/usr/local/lib/node_modules/npm/node_modules; \
    for spec in undici@^6.28.1 brace-expansion@^5.0.11; do \
      n=${spec%@*}; npm pack "$spec" --silent >/dev/null; \
      rm -rf "$N/$n"; mkdir "$N/$n"; tar -xzf "$n"-*.tgz -C "$N/$n" --strip-components=1; \
    done; rm -f /tmp/*.tgz; npm --version

# Install OpenSSL for Prisma
# See APK_REFRESH above (an ARG does not carry across stages).
ARG APK_REFRESH=unset
RUN echo "apk refresh: $APK_REFRESH" && apk add --no-cache openssl

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/codex/services/doc-websocket/package.json ./apps/codex/services/doc-websocket/package.json
COPY --from=builder /app/apps/codex/services/doc-websocket/dist ./apps/codex/services/doc-websocket/dist
# zod 4 installs into the workspace's own node_modules (the root hoists zod 3
# for other workspaces); copying only /app/node_modules silently drops it.
COPY --from=builder /app/apps/codex/services/doc-websocket/node_modules ./apps/codex/services/doc-websocket/node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/apps/codex/services/doc-websocket/prisma ./apps/codex/services/doc-websocket/prisma

# Set environment
ENV NODE_ENV=production

# Expose WebSocket port
EXPOSE 3002

ARG VERSION=dev
ARG COMMIT_SHA=unknown

LABEL org.opencontainers.image.title="Nexus Codex Document WebSocket" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

WORKDIR /app/apps/codex/services/doc-websocket

CMD ["node", "dist/index.js"]
