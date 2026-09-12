FROM postgres:18-alpine

ARG VERSION=dev
ARG COMMIT_SHA=unknown

# Copy the schema file to the entrypoint directory
# Build context is the repo root, so path is relative to root
COPY server/schema.sql /docker-entrypoint-initdb.d/

LABEL org.opencontainers.image.title="Nexus VTT PostgreSQL" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"
