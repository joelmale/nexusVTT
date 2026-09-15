# Elasticsearch 9.5.3 Upgrade & Re-index Runbook

## Overview

NexusCodex has been updated from Elasticsearch **8.11.0** to **9.5.3**.
Because Elasticsearch 9 utilizes Lucene 10, existing index directories from 8.11.0 cannot be mounted directly. In NexusCodex, **PostgreSQL (`prisma.document`) is the canonical source of truth** for all document data, while Elasticsearch functions as a search projection.

This runbook describes the procedure to deploy Elasticsearch 9.5.3 in the homelab / staging environment and re-index documents from PostgreSQL.

---

## Changes Implemented

1. **Docker Compose:**
   - Updated `codex-elasticsearch` image to `docker.elastic.co/elasticsearch/elasticsearch:9.5.3`.
   - Maintained `discovery.type: single-node` and `xpack.security.enabled: 'false'` on internal `homelab-net`.
2. **Client Library:**
   - Upgraded `@elastic/elasticsearch` to `^9.5.1` in:
     - `apps/codex/services/doc-api`
     - `apps/codex/services/doc-processor`
     - `apps/codex/services/doc-websocket`
3. **API Modernization:**
   - Removed deprecated `body: { ... }` wrappers in `client.search()`, `client.index()`, `client.indices.create()`, and `client.deleteByQuery()`, replacing them with top-level parameters required by Elasticsearch client v9.

---

## Deployment & Re-indexing Procedure

### Step 1: Clean/Reset the Elasticsearch Volume

Before starting the Elasticsearch 9.5.3 container on a node with an existing 8.11 volume:

```bash
# In Dockhand or Docker CLI:
# 1. Stop the existing codex-elasticsearch container
docker stop nexus-vtt2-codex-elasticsearch-1

# 2. Remove the legacy 8.11 data volume (or rename for backup)
docker volume rm nexus-vtt2-codex-elasticsearch-data
# (Docker Compose will automatically recreate the volume on next deployment)
```

### Step 2: Deploy the Stack

Deploy the updated `compose.yaml`:

```bash
docker compose up -d codex-elasticsearch doc-api doc-processor doc-websocket admin-ui
```

### Step 3: Verify Elasticsearch Cluster Health

Confirm Elasticsearch 9.5.3 is running and responding:

```bash
curl http://localhost:9200/_cluster/health
```

Expected output:
```json
{
  "cluster_name": "docker-cluster",
  "status": "green" | "yellow",
  ...
}
```

Or query the Codex health endpoint:

```bash
curl http://localhost:3005/api/admin/elasticsearch/health
```

### Step 4: Recreate Index Mapping

Trigger index creation with the updated mapping schema:

```bash
curl -X POST http://localhost:3005/api/admin/elasticsearch/recreate-index
```

### Step 5: Trigger Re-index from PostgreSQL

Execute the full re-index to project all OCR-completed documents from PostgreSQL into the fresh Elasticsearch 9.5.3 index:

```bash
curl -X POST "http://localhost:3005/api/admin/elasticsearch/reindex?force=true&batchSize=100"
```

Response format:
```json
{
  "success": true,
  "total": 150,
  "processed": 150,
  "failed": 0,
  "errors": []
}
```

*(You can also track cluster health, document count, and re-indexing progress interactively from the Admin UI at `http://localhost:3001/elasticsearch`).*

### Step 6: Validate Document Search

Verify full-text search is operating against the new index:

```bash
curl "http://localhost:3005/api/documents/search?q=spell"
```
