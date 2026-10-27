# Alpine, like the other Node services: the Debian image carried hundreds of
# unfixed HIGH/CRITICAL CVEs (the release scan does not ignore unfixed ones),
# and its runtime stage inherited the whole build toolchain.
#
# Canvas: @napi-rs/canvas and sharp ship musl prebuilds, so the runtime needs
# no build tools. node-canvas (the fallback backend in src/utils/canvas.ts) is
# compiled in the deps stage; its shared libraries are installed at runtime.
FROM node:26.11.1-alpine AS base
# OpenSSL in every stage, not only the runtime: `prisma generate` picks the
# query engine from the OpenSSL it finds at build time. Without it the builder
# bundles the plain "linux-musl" engine and the runtime (OpenSSL 3) fails at
# the first query with "could not locate the Query Engine for
# linux-musl-openssl-3.0.x".
# APK_REFRESH exists only to invalidate the cached apk layers. CI builds with
# cache-from the registry buildcache, and Docker keys a layer on the command
# text and base tag, not on the Alpine repository, so "apk upgrade" and
# "apk add" stayed CACHED and kept shipping libexpat, libx11 and libxrender
# versions that Trivy flagged HIGH with fixes available. Change the date to
# force a fresh package install when a base-package CVE appears.
ARG APK_REFRESH=2026-10-19
RUN echo "apk refresh: $APK_REFRESH" && apk upgrade --no-cache && apk add --no-cache openssl
# npm's own bundled undici/brace-expansion carry High advisories (Trivy
# --ignore-unfixed) that even the latest npm release still ships. Swap in patched
# copies of the same major so the scanned runtime image is clean.
RUN set -e; cd /tmp; N=/usr/local/lib/node_modules/npm/node_modules; \
    for spec in undici@^6.28.1 brace-expansion@^5.0.11; do \
      n=${spec%@*}; npm pack "$spec" --silent >/dev/null; \
      rm -rf "$N/$n"; mkdir "$N/$n"; tar -xzf "$n"-*.tgz -C "$N/$n" --strip-components=1; \
    done; rm -f /tmp/*.tgz; npm --version

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache \
    build-base \
    python3 \
    pkgconf \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    pixman-dev \
    freetype-dev
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/codex/services/doc-processor/package.json ./apps/codex/services/doc-processor/
COPY packages/document-contracts/package.json ./packages/document-contracts/
RUN npm ci \
    --workspace=nexus-codex-doc-processor \
    --workspace=@nexus/document-contracts \
    --include-workspace-root

# The lockfile does not record @napi-rs/canvas's musl prebuild (npm only
# resolves the optional dependencies of the platform that generated the lock),
# so unpack the matching one explicitly; without it src/utils/canvas.ts
# silently falls back to node-canvas. Unpacked by hand rather than with
# `npm install`, which would re-reify node_modules and drop node-canvas's
# compiled canvas.node.
RUN arch="$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')" && \
    ver="$(node -p "require('./node_modules/@napi-rs/canvas/package.json').version")" && \
    dest="node_modules/@napi-rs/canvas-linux-${arch}-musl" && \
    (cd /tmp && npm pack --silent "@napi-rs/canvas-linux-${arch}-musl@${ver}") && \
    mkdir -p "$dest" && \
    tar -xzf "/tmp/napi-rs-canvas-linux-${arch}-musl-${ver}.tgz" --strip-components=1 -C "$dest" && \
    rm -f /tmp/*.tgz

# Rebuild the source code only when needed
FROM deps AS builder
WORKDIR /app

COPY . .

# The Prisma schema is owned by doc-api; prisma:generate reads it from there.
RUN node scripts/build-workspace-dependencies.mjs --workspace nexus-codex-doc-processor && \
    npm run prisma:generate --workspace=nexus-codex-doc-processor && \
    npm run build --workspace=nexus-codex-doc-processor

# Production image, copy all the files and run
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Runtime libraries only: OpenSSL for Prisma, cairo/pango for node-canvas.
# Layers built on base are rebuilt when base changes; the ARG is also kept here
# (with the same default, since an ARG does not carry across stages) so this
# layer's own command text changes whenever the date does. See APK_REFRESH above.
ARG APK_REFRESH=2026-10-19
RUN echo "apk refresh: $APK_REFRESH" && apk add --no-cache \
    openssl \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    pixman \
    freetype

# Create a non-root user
RUN addgroup -S -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs worker

# Dependencies that could not hoist install into the workspace's own
# node_modules. Copying only /app/node_modules silently drops them.
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/apps/codex/services/doc-processor/node_modules ./apps/codex/services/doc-processor/node_modules
COPY --from=builder --chown=worker:nodejs /app/apps/codex/services/doc-processor/dist ./apps/codex/services/doc-processor/dist
COPY --from=builder --chown=worker:nodejs /app/apps/codex/services/doc-processor/package.json ./apps/codex/services/doc-processor/package.json
COPY --from=builder --chown=worker:nodejs /app/package.json ./package.json
# Workspace dependency, symlinked from node_modules/@nexus/document-contracts.
COPY --from=builder --chown=worker:nodejs /app/packages/document-contracts/package.json ./packages/document-contracts/package.json
COPY --from=builder --chown=worker:nodejs /app/packages/document-contracts/dist ./packages/document-contracts/dist
# Its zod 4 install is nested (the root hoists zod 3 for other workspaces).
COPY --from=builder --chown=worker:nodejs /app/packages/document-contracts/node_modules ./packages/document-contracts/node_modules

USER worker
WORKDIR /app/apps/codex/services/doc-processor

ARG VERSION=dev
ARG COMMIT_SHA=unknown

LABEL org.opencontainers.image.title="Nexus Codex Document Processor" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

# Start the worker
CMD ["node", "dist/index.js"]
