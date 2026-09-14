# NexusCodex Architecture & Interface Control Document (ICD)

## 1. System Overview
NexusCodex is a microservices platform for document ingestion, OCR, indexing, and real-time collaboration in VTT workflows. The core services are:
- `doc-api` (Fastify REST API)
- `doc-processor` (BullMQ worker for ingestion pipeline)
- `doc-websocket` (WebSocket server for live sync)
- `admin-ui` (React admin console)

Supporting infrastructure:
- PostgreSQL (system-of-record)
- Redis (queues + session state)
- ElasticSearch (full-text search)
- S3-compatible storage (MinIO in dev)
- Kibana (log browsing)

## 2. Service Catalog

### 2.1 doc-api (Fastify)
- **Role**: Public API, document CRUD, ingestion orchestration, search endpoints, admin ops.
- **Port**: 3000 (docker mapped to 3005).
- **Key Responsibilities**:
  - Create documents + pre-signed upload URLs
  - Enqueue ingestion jobs
  - Provide search endpoints (keyword + semantic + ask)
  - Provide admin endpoints (queue, logs, validation, metrics)
  - Serve reader page-image URLs
- **Primary Dependencies**:
  - PostgreSQL (Prisma)
  - Redis (BullMQ producer)
  - ElasticSearch (search)
  - S3/MinIO (signed URLs)

### 2.2 doc-processor (BullMQ Worker)
- **Role**: Executes staged ingestion pipeline.
- **Queues**:
  - `document-processing` (ingest, render, ocr, extract, index)
  - `document-assets` (thumbnail + page images)
- **Key Responsibilities**:
  - Content hash + dedupe
  - Layout-aware PDF extraction + OCR
  - Structured data extraction + entity resolution
  - Chunking + embeddings
  - Search indexing
  - Asset generation (thumbnails, page images)
- **Primary Dependencies**:
  - PostgreSQL (Prisma)
  - Redis (BullMQ consumer)
  - ElasticSearch (indexing)
  - S3/MinIO (document + assets)

### 2.3 doc-websocket (WebSocket)
- **Role**: Real-time collaboration and VTT push events.
- **Port**: 3002
- **Key Responsibilities**:
  - Session management
  - Page/scroll sync
  - Annotations broadcast
  - VTT entity push events
- **Primary Dependencies**:
  - Redis (session persistence)

### 2.4 admin-ui (React + Vite)
- **Role**: Admin control plane for documents, queues, logs, quality, search.
- **Port**: 80 (docker mapped to 3001)
- **Key Responsibilities**:
  - Document management
  - Processing reports + logs
  - Search & dedupe tools
  - Command palette for global search

## 3. Data Stores & Schemas

### 3.1 PostgreSQL
- Primary system-of-record for documents, text, chunks, structured data, entities.
- Key tables:
  - `documents`, `document_texts`, `document_chunks`
  - `structured_data`
  - `entities`, `entity_aliases`, `entity_links`, `entity_mentions`
  - `document_references`, `document_annotations`

### 3.2 ElasticSearch
- Full-text index for documents (document-level content).
- Used by keyword search and admin health checks.

### 3.3 Redis
- BullMQ queues: `document-processing`, `document-assets`
- WebSocket sessions and TTL refresh.

### 3.4 S3/MinIO
- Raw documents (`documents/*`)
- OCR temp pages (`ocr-temp/*`)
- Page images (`page-images/*`)
- Thumbnails (`thumbnails/*`)

## 4. Ingestion Pipeline (Staged)

1) **ingest**
   - Download file from S3
   - Compute content hash
   - Detect duplicates and short-circuit if needed
2) **render**
   - Layout-aware text extraction (PDF)
   - Markdown extraction
   - Determine OCR need
   - Render OCR PNGs if needed
3) **ocr**
   - OCR via worker pool
   - Store OCR text and cleanup temp assets
4) **extract**
   - Structured data parsing (spell/monster/item)
   - Entity resolution + mention linking
   - Chunking + embeddings
5) **index**
   - ElasticSearch indexing
6) **assets**
   - Thumbnail generation
   - Page images (WebP)

Checkpoint metadata is persisted in `documents.metadata.processing` with per-stage timestamps and durations.

## 5. API Interfaces (ICD Level)

### 5.1 doc-api (REST)
**Documents**
- `POST /api/documents` → create document + signed upload URL
- `POST /api/documents/:id/process` → enqueue ingestion
- `GET /api/documents/:id/processing-status` → status + metadata
- `GET /api/documents/:id/page-images` → signed reader URLs

**Search**
- `GET /api/search` → keyword search
- `GET /api/search/semantic` → hybrid chunk search
- `POST /api/search/ask` → grounded Q&A with citations

**Admin**
- `GET /api/admin/queue/*` → job stats, list, logs
- `GET /api/admin/processing/*` → processing quality, report
- `GET /api/admin/logs` → central log search

**VTT Export**
- `GET /api/vtt/export/:entityId?format=foundry|generic`

### 5.2 doc-websocket (WS)
**Session**
- `doc:session:create`
- `doc:session:join`
- `doc:session:leave`
- `doc:session:update-settings`

**Navigation Sync**
- `doc:page:change`
- `doc:scroll:sync`

**DM Push**
- `doc:push:page`
- `doc:push:reference`

**Annotations**
- `doc:annotation:create`
- `doc:annotation:update`
- `doc:annotation:delete`

**VTT**
- `vtt:register`
- `vtt:entity:push`
- `vtt:state:update`

## 6. Authentication & Authorization
- REST uses JWT (auth can be disabled in dev via `AUTH_DISABLED`).
- WebSocket requires JWT query param.
- VTT pushes require presenter role on session.

## 7. Logging & Observability
- Central logging written to ElasticSearch.
- `doc-api` exposes `/api/admin/logs` for UI.
- Kibana exposes full log search.
- Ingestion logs per stage include durations and checkpoints.

## 8. Failure Modes & Recovery
- Stage checkpoints allow resuming failed ingestion without redoing prior stages.
- Asset generation is isolated to prevent blocking extraction/indexing.
- Duplicate detection prevents reprocessing identical content.
- OCR temp artifacts are cleaned after processing.

## 9. Environment Variables (Core)

Common:
- `DATABASE_URL`, `REDIS_URL`, `ELASTICSEARCH_URL`
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`

doc-processor:
- `QUEUE_NAME`, `ASSET_QUEUE_NAME`
- `OCR_WORKER_POOL_SIZE`, `OCR_MAX_PAGES`
- `EMBEDDINGS_PROVIDER`, `EMBEDDINGS_DIM`

doc-api:
- `AUTH_DISABLED`, `EMBEDDINGS_PROVIDER`, `LLM_PROVIDER`

## 10. Deployment Notes
- Docker compose provides a full local stack.
- Production should use managed Postgres, Redis, ES, and S3.
- Apply migrations in `doc-api` and regenerate Prisma clients in each service.
