FROM node:26.11.1-alpine AS base

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

# Install OpenSSL for Prisma and git for SRD import
# APK_REFRESH keys the apk layers to the calendar week (CI passes it), so a
# cached "apk add" layer cannot keep shipping packages that have since been
# fixed. Docker keys layers on the command text, not on the Alpine repository.
ARG APK_REFRESH=unset
RUN echo "apk refresh: $APK_REFRESH" && apk add --no-cache openssl git

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy root and participating workspace manifests.
COPY package.json package-lock.json ./
COPY apps/codex/services/doc-api/package.json ./apps/codex/services/doc-api/
COPY packages/document-contracts/package.json ./packages/document-contracts/
COPY packages/rules-contracts/package.json ./packages/rules-contracts/

RUN npm ci \
    --workspace=nexus-codex-doc-api \
    --workspace=@nexus/document-contracts \
    --workspace=@nexus/rules-contracts \
    --include-workspace-root

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# zod 4 is not the version the repo root hoists (other workspaces still use
# zod 3), so it installs into each workspace's own node_modules. Copying only
# /app/node_modules silently drops it.
COPY --from=deps /app/apps/codex/services/doc-api/node_modules ./apps/codex/services/doc-api/node_modules
COPY --from=deps /app/packages/document-contracts/node_modules ./packages/document-contracts/node_modules
COPY --from=deps /app/packages/rules-contracts/node_modules ./packages/rules-contracts/node_modules
COPY package.json package-lock.json ./
COPY apps/codex/services/doc-api/package.json ./apps/codex/services/doc-api/
COPY apps/codex/services/doc-api/tsconfig.json ./apps/codex/services/doc-api/
COPY apps/codex/services/doc-api/prisma ./apps/codex/services/doc-api/prisma
COPY apps/codex/services/doc-api/src ./apps/codex/services/doc-api/src
COPY packages/document-contracts ./packages/document-contracts
COPY packages/rules-contracts ./packages/rules-contracts
COPY scripts/build-workspace-dependencies.mjs ./scripts/build-workspace-dependencies.mjs

RUN node scripts/build-workspace-dependencies.mjs --workspace nexus-codex-doc-api && \
    npm run prisma:generate --workspace=nexus-codex-doc-api && \
    npm run build --workspace=nexus-codex-doc-api

# Production image, copy all the files and run
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fastify

# Copy necessary files
COPY --from=builder /app/node_modules ./node_modules
# zod 4 is not the version the repo root hoists (other workspaces still use
# zod 3), so it installs into each workspace's own node_modules. Copying only
# /app/node_modules silently drops it.
COPY --from=builder /app/apps/codex/services/doc-api/node_modules ./apps/codex/services/doc-api/node_modules
COPY --from=builder /app/packages/rules-contracts/node_modules ./packages/rules-contracts/node_modules
COPY --from=builder /app/apps/codex/services/doc-api/dist ./apps/codex/services/doc-api/dist
COPY --from=builder /app/apps/codex/services/doc-api/prisma ./apps/codex/services/doc-api/prisma
COPY --from=builder /app/apps/codex/services/doc-api/package.json ./apps/codex/services/doc-api/package.json
COPY --from=builder /app/packages/document-contracts ./packages/document-contracts
COPY --from=builder /app/packages/rules-contracts/package.json ./packages/rules-contracts/package.json
COPY --from=builder /app/packages/rules-contracts/dist ./packages/rules-contracts/dist
COPY --from=builder /app/package.json ./package.json

# Change ownership
RUN chown -R fastify:nodejs /app

USER fastify
WORKDIR /app/apps/codex/services/doc-api

EXPOSE 3000

ARG VERSION=dev
ARG COMMIT_SHA=unknown

LABEL org.opencontainers.image.title="Nexus Codex Document API" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

# Run database migrations and start the compiled server. `exec` makes node PID 1
# explicitly, so SIGTERM from `docker stop` reaches the server's shutdown handler
# whatever the shell does (Alpine's busybox ash already execs the last command).
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/server.js"]
