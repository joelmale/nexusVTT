# Alpine, like the other Node services: the Debian image carried hundreds of
# unfixed HIGH/CRITICAL CVEs (the release scan does not ignore unfixed ones),
# and its runtime stage inherited the whole build toolchain.
#
# Canvas: @napi-rs/canvas and sharp ship musl prebuilds, so the runtime needs
# no build tools. node-canvas (the fallback backend in src/utils/canvas.ts) is
# compiled in the deps stage; its shared libraries are installed at runtime.
FROM node:26.10.0-alpine AS base
# OpenSSL in every stage, not only the runtime: `prisma generate` picks the
# query engine from the OpenSSL it finds at build time. Without it the builder
# bundles the plain "linux-musl" engine and the runtime (OpenSSL 3) fails at
# the first query with "could not locate the Query Engine for
# linux-musl-openssl-3.0.x".
RUN apk upgrade --no-cache && apk add --no-cache openssl
# npm's own bundled undici/brace-expansion carry High advisories (Grype
# --only-fixed) that even the latest npm release still ships. Swap in patched
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
RUN npm ci --workspace=nexus-codex-doc-processor --include-workspace-root

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

RUN npm run prisma:generate --workspace=nexus-codex-doc-processor && \
    npm run build --workspace=nexus-codex-doc-processor

# Production image, copy all the files and run
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Runtime libraries only: OpenSSL for Prisma, cairo/pango for node-canvas.
RUN apk add --no-cache \
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

# Dependencies that could not hoist (bullmq@5 here, because doc-api pins
# bullmq@4 at the root) install into the workspace's own node_modules.
# Copying only /app/node_modules silently drops them.
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/apps/codex/services/doc-processor/node_modules ./apps/codex/services/doc-processor/node_modules
COPY --from=builder --chown=worker:nodejs /app/apps/codex/services/doc-processor/dist ./apps/codex/services/doc-processor/dist
COPY --from=builder --chown=worker:nodejs /app/apps/codex/services/doc-processor/prisma ./apps/codex/services/doc-processor/prisma
COPY --from=builder --chown=worker:nodejs /app/apps/codex/services/doc-processor/package.json ./apps/codex/services/doc-processor/package.json
COPY --from=builder --chown=worker:nodejs /app/package.json ./package.json

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
