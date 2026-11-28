# The homelab uses a dedicated PostgreSQL 19 data directory. Coordinate major
# version changes with the homelab storage and bootstrap steps.
FROM postgres:19.0-alpine

# Security CI and Delivery pass a weekly value to refresh the APK build layer.
ARG APK_REFRESH=unset
RUN echo "apk refresh: $APK_REFRESH" && \
    apk upgrade --no-cache && \
    apk add --no-cache 'libxml2>=2.13.9-r5'

# The upstream image ships /usr/local/bin/gosu built with an old Go toolchain,
# which Trivy flags for stdlib CVEs. Replace it with Alpine's rebuilt package;
# the entrypoint resolves gosu via PATH, where /usr/bin still finds it.
RUN apk add --no-cache gosu \
    && rm -f /usr/local/bin/gosu

# Copy the schema file to the entrypoint directory
# Build context is the repo root, so path is relative to root
COPY apps/vtt/server/schema.sql /docker-entrypoint-initdb.d/

ARG VERSION=dev
ARG COMMIT_SHA=unknown

LABEL org.opencontainers.image.title="Nexus VTT PostgreSQL" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"
