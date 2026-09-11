#!/bin/bash

# Start NexusCodex services and core dependencies in Docker Compose
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but not installed."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is required but not available."
  exit 1
fi

echo "Starting core infrastructure (postgres, redis, minio, elasticsearch)..."
docker compose up -d postgres redis minio elasticsearch

echo "Starting NexusCodex services (doc-api, doc-processor, doc-websocket, admin-ui)..."
docker compose up -d doc-api doc-processor doc-websocket admin-ui

echo ""
echo "Services are starting. Useful endpoints:"
echo "  - doc-api:           http://localhost:3005"
echo "  - admin-ui:          http://localhost:3001"
echo "  - doc-websocket:     ws://localhost:3002/ws"
echo "  - MinIO API:         http://localhost:9000"
echo "  - MinIO console:     http://localhost:9001"
echo "  - Elasticsearch:     http://localhost:9200"
echo ""
echo "Tail logs: docker compose logs -f doc-api doc-processor doc-websocket admin-ui"
