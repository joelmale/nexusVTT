FROM postgres:18-alpine

# Copy the schema file to the entrypoint directory
# Build context is the repo root, so path is relative to root
COPY server/schema.sql /docker-entrypoint-initdb.d/
