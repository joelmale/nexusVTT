# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NexusCodex is a document library microservice for a Virtual Tabletop (VTT) system, enabling document upload, processing, search, real-time collaboration, and structured data extraction for D&D content. The system is composed of four microservices (three Node.js/TypeScript backend services and one React frontend) orchestrated via Docker Compose.

## Architecture

### Microservices

**doc-api** (Port 3000)
- Fastify-based REST API for document CRUD operations
- Handles document uploads via S3 pre-signed URLs
- Manages references/bookmarks, annotations, and structured data
- Supports HTTP Range requests for PDF streaming (critical for PDF.js)
- Triggers background processing jobs via BullMQ
- Admin endpoints for queue management, document validation, and system stats

**doc-processor** (Background Worker)
- BullMQ worker that processes uploaded documents
- PDF text extraction (pdf-parse), thumbnail generation (sharp/pdfjs-dist)
- OCR support for image-based PDFs (Tesseract.js)
- Markdown processing (remark/unified)
- Structured data extraction for D&D content (spells, monsters, items)
- Indexes extracted text in ElasticSearch (NOT in PostgreSQL)
- Content hash calculation for duplicate detection

**doc-websocket** (Port 3002)
- Express + ws-based WebSocket server for real-time collaboration
- Session management (Redis-backed with TTL)
- Synchronized document viewing (page navigation, scroll position)
- Real-time annotation sync across session participants
- DM "push" features to force page navigation for players

**admin-ui** (Port 3001)
- React + Vite-based admin dashboard
- Uses shadcn/ui components with Tailwind CSS
- TanStack Query for data fetching and caching
- Monitors processing queues, document status, and system health
- Manages document metadata, duplicates, and validation
- View processing logs and retry failed jobs

### Storage Layer

- **PostgreSQL 16**: Primary datastore (Prisma ORM) for documents, references, annotations, structured data
- **Redis 7**: BullMQ job queue + WebSocket session storage
- **ElasticSearch 8**: Full-text search for document content (text NOT stored in Postgres)
- **S3-Compatible Storage**: Document file storage
  - **Development**: MinIO (Docker container)
  - **Production**: Google Cloud Storage (GCS), AWS S3, or Cloudflare R2

### Data Flow

1. Client requests document upload → doc-api generates S3 pre-signed URL
2. Client uploads file directly to S3
3. doc-api enqueues processing job to BullMQ (Redis)
4. doc-processor picks up job → extracts text, generates thumbnail, OCR if needed
5. Extracted text indexed in ElasticSearch (NOT saved to Postgres)
6. Structured data (spells, monsters, etc.) extracted and saved to Postgres
7. Client queries via REST API or WebSocket for real-time collaboration

**CRITICAL**: Text content is stored ONLY in ElasticSearch to keep the primary database lean. The `Document` model has no `textContent` field.

## Common Commands

### Start All Services

```bash
# Build and start all services (postgres, redis, elasticsearch, minio, all microservices)
docker compose up --build

# Start in background
docker compose up -d

# View logs
docker compose logs -f [service-name]
```

### Stop Services

```bash
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v
```

### Database Management (Prisma)

```bash
cd services/doc-api  # or doc-processor or doc-websocket

# Generate Prisma client after schema changes
npm run prisma:generate

# Push schema changes to database (dev only, no migrations)
npm run prisma:push

# Open Prisma Studio (GUI for database)
npm run prisma:studio

# Create migration (for production-ready schema changes)
npm run prisma:migrate
```

### Development

```bash
cd services/[service-name]

# Install dependencies
npm install

# Run in watch mode (hot reload with tsx for backend services)
npm run dev

# For admin-ui, uses Vite dev server
cd services/admin-ui && npm run dev

# Build TypeScript (backend services)
npm run build

# Build admin-ui for production
cd services/admin-ui && npm run build

# Start production build
npm start
```

### Testing

```bash
# Quick smoke test (health checks for all services)
./test-stack.sh

# Run unit tests
cd services/doc-api && npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Integration tests
npm run test:integration

# Full test suite (all services)
./run-tests.sh all
```

### Data Import & SRD Content

NexusCodex includes a comprehensive import system for prepopulating the database with D&D 5e SRD content from the `5e-bits/5e-database` repository.

```bash
cd services/doc-api

# Import all SRD content (23 categories: spells, monsters, items, etc.)
npm run import:5e-srd

# Preview import without writing to database
npm run import:5e-srd:dry-run

# Import specific content types only
npm run import:5e-srd -- --types spells,monsters,magic-items

# Use existing repository clone (offline mode)
npm run import:5e-srd -- --repo-path /path/to/5e-database

# Verbose logging for debugging
npm run import:5e-srd -- --verbose

# Show all available options
npm run import:5e-srd:help
```

**Import Features:**
- ✅ **Complete SRD Coverage** - All 23 content categories (spells, monsters, magic items, equipment, classes, races, backgrounds, feats, conditions, rules, etc.)
- ✅ **Structured Data** - Creates both `Document` and `StructuredData` records for full system features
- ✅ **Markdown Formatting** - Converts description arrays to clean Markdown with proper paragraphs
- ✅ **Auto-tagging** - Intelligent tagging (e.g., spells get level, school, class tags)
- ✅ **ElasticSearch Indexing** - Full-text search for all imported content
- ✅ **Idempotent** - Safe to re-run, updates existing entries
- ✅ **Offline Capability** - Clones repository once, works without internet after

**What Gets Created:**

For each SRD entry (e.g., "Fireball" spell):
1. **Document Record**
   - `title`: "Fireball"
   - `description`: Formatted Markdown with spell details
   - `type`: `srd_content` (distinguishes from user uploads)
   - `tags`: `["srd", "spell", "level-3", "evocation", "wizard", "sorcerer"]`
   - `metadata`: Complete JSON from source
   - `storageKey`: Virtual path (no S3 file needed)

2. **StructuredData Record**
   - `type`: `spell`
   - `name`: "Fireball"
   - `data`: Full spell JSON (level, components, damage, etc.)
   - `searchText`: Flattened text for search

3. **ElasticSearch Index**
   - Full-text searchable content
   - Faceted filtering by type, level, school, etc.

**Supported Content Types:**
- `spells`, `monsters`, `magic-items`, `equipment`
- `classes`, `subclasses`, `races`, `subraces`
- `backgrounds`, `feats`, `features`, `traits`
- `skills`, `proficiencies`, `ability-scores`
- `conditions`, `damage-types`, `magic-schools`, `weapon-properties`
- `alignments`, `languages`, `rules`, `rule-sections`, `equipment-categories`

**Parser Architecture:**

The import system uses specialized parsers for different content types:
- **SpellParser** - Spell-specific formatting (level, school, components, higher levels)
- **MonsterParser** - Formatted stat blocks with abilities and actions
- **EquipmentParser** - Items and magic items with cost/weight
- **GenericParser** - Fallback for simple content types

**Adding Custom Content:**

After importing SRD content, you can add your own non-SRD content:
1. Follow the same pattern in `services/doc-api/src/scripts/`
2. Create custom parsers for your data format
3. Use the same `Document` + `StructuredData` structure
4. Tag with custom tags to distinguish from SRD

**Example: Import Spells Only**
```bash
# Preview spell import
docker compose exec doc-api npm run import:5e-srd -- --types spells --dry-run

# Import spells to database
docker compose exec doc-api npm run import:5e-srd -- --types spells
```

**Troubleshooting:**
- ⚠️ **Must run inside Docker container** - Uses env vars (DATABASE_URL, ELASTICSEARCH_URL, etc.)
- ⚠️ **Requires git** - Clones repository during import (or use `--repo-path` for pre-cloned repo)
- ⚠️ **First run takes time** - Cloning repo and indexing 2000+ entries (5-10 minutes)
- ⚠️ **Subsequent runs faster** - Only updates changed entries

## Dependency Management & Security Updates

### Node.js Version Requirements

**All services require Node.js 22+** as specified in `package.json` engine requirements:
- Vite 7.x (admin-ui) requires Node.js 22+
- All backend services standardized on Node.js 22 for consistency
- Docker images use `node:22-alpine` base images

### Updating Dependencies

#### Regular Dependency Updates

Update dependencies monthly or when security vulnerabilities are discovered:

```bash
# Check for outdated packages in a service
cd services/[service-name]
npm outdated

# Update all dependencies to latest minor/patch versions
npm update

# Update specific package to latest version
npm install package-name@latest

# Update major versions (requires testing)
npm install package-name@^X.0.0

# Verify no breaking changes
npm test
```

#### Security Audits

Run security audits regularly:

```bash
# Check for vulnerabilities
npm audit

# Attempt automatic fixes
npm audit fix

# Fix vulnerabilities (may update to major versions)
npm audit fix --force

# Check specific service
cd services/doc-api && npm audit
```

#### Automated Dependency Updates

**Recommended Tools:**
- **Dependabot** (GitHub): Automated PR creation for dependency updates
- **Renovate**: More customizable, supports monorepos well
- **npm-check-updates**: Manual CLI tool for batch updates

**Setup Dependabot** (create `.github/dependabot.yml`):
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/services/doc-api"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/services/doc-processor"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/services/doc-websocket"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/services/admin-ui"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "monthly"
```

### Docker Image Updates

#### Base Image Updates

Update Node.js and other base images regularly:

```bash
# Pull latest Node.js 22 alpine image
docker pull node:22-alpine

# Pull latest PostgreSQL 16
docker pull postgres:16-alpine

# Pull latest Redis 7
docker pull redis:7-alpine

# Pull latest ElasticSearch 8
docker pull elasticsearch:8.11.0

# Rebuild all services with updated base images
docker compose build --no-cache
```

#### Vulnerability Scanning

Scan Docker images for security vulnerabilities:

```bash
# Using Docker Scout (built into Docker Desktop)
docker scout cves nexuscodex-doc-api

# Using Trivy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image nexuscodex-doc-api

# Scan all images
for img in doc-api doc-processor doc-websocket admin-ui; do
  docker scout cves nexuscodex-$img
done
```

### Critical Dependencies to Monitor

**Backend Services:**
- `fastify` - Web framework (security patches critical)
- `@prisma/client` - Database ORM
- `@fastify/jwt` - Authentication (security critical)
- `bullmq` - Job queue
- `@elastic/elasticsearch` - Search client

**Admin UI:**
- `vite` - Build tool (requires Node.js 22+)
- `react` - UI framework
- `@tanstack/react-query` - Data fetching
- `react-router-dom` - Routing

**Processing:**
- `pdf-parse` - PDF extraction
- `sharp` - Image processing (native dependencies)
- `tesseract.js` - OCR

### Database Migrations

When updating Prisma:

```bash
cd services/doc-api

# Update Prisma
npm install @prisma/client@latest prisma@latest

# Regenerate Prisma Client
npm run prisma:generate

# Create migration (if schema changed)
npm run prisma:migrate dev --name update_prisma

# Apply to production
npm run prisma:migrate deploy
```

### Update Checklist

Before deploying updates:

- [ ] Run `npm audit` on all services
- [ ] Update `package.json` dependencies
- [ ] Run `npm test` on all services
- [ ] Test integration with `./test-stack.sh`
- [ ] Update Docker base images
- [ ] Scan Docker images for vulnerabilities
- [ ] Test full stack with `docker compose up --build`
- [ ] Review CHANGELOG/release notes for breaking changes
- [ ] Update documentation if APIs change
- [ ] Create git tag for stable release

### Rollback Strategy

If updates cause issues:

```bash
# Rollback to previous package versions
git checkout HEAD~1 -- services/*/package*.json
cd services/[service-name] && npm install

# Rollback Docker images
docker compose down
git checkout HEAD~1 -- services/*/Dockerfile
docker compose up --build

# Rollback database migrations (Prisma)
cd services/doc-api
npx prisma migrate resolve --rolled-back <migration-name>
```

### Version Pinning vs. Ranges

**Current Strategy:**
- **Development**: Use ranges (`^` for minor, `~` for patch) to get security updates
- **Production**: Consider exact versions for critical dependencies
- **Docker**: Pin base image tags (e.g., `node:22.1.0-alpine` vs. `node:22-alpine`)

**Lock Files:**
- `package-lock.json` committed to git (ensures reproducible builds)
- Run `npm ci` in Docker (uses lockfile, faster, more reliable than `npm install`)

### Monitoring & Alerts

**GitHub Actions** (create `.github/workflows/security.yml`):
```yaml
name: Security Audit
on:
  schedule:
    - cron: '0 0 * * 1' # Weekly on Monday
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Audit dependencies
        run: |
          for dir in services/*/; do
            echo "Auditing $dir"
            cd $dir && npm audit || true
            cd ../..
          done
```

## Key Implementation Details

### HTTP Range Header Support

The `GET /api/documents/:id/content` endpoint in doc-api **must** support HTTP Range headers for PDF.js to function correctly. This is implemented in `services/doc-api/src/routes/documents.ts` using S3's `Range` parameter.

### Document Processing Pipeline

1. Upload triggers BullMQ job in doc-api (`services/doc-api/src/services/queue.service.ts`)
2. Worker in doc-processor consumes job (`services/doc-processor/src/workers/process-document.worker.ts`)
3. Processing steps:
   - Download from S3
   - Extract text (PDF or Markdown)
   - Generate thumbnail (first page for PDFs)
   - OCR if image-based PDF detected
   - Extract structured D&D content (spells, monsters, items)
   - Index text in ElasticSearch
   - Save structured data to Postgres
   - Update document status

### WebSocket Event Flow

Clients connect to `ws://localhost:3002/ws` and send/receive JSON messages with `{ type, data }` structure. All events are validated with Zod schemas in `services/doc-websocket/src/types/events.ts`.

**Session Flow**:
1. DM sends `doc:session:create` → creates session in Redis
2. Players send `doc:session:join` → adds to session viewers list
3. Page changes broadcast via `page:changed` if sync enabled
4. DM can force navigation with `doc:push:page` (always broadcasts)

### Structured Data Extraction

The extraction service (`services/doc-processor/src/services/extraction.service.ts`) uses regex patterns to identify and parse D&D content:

- **Spells**: Pattern matches "X-level [school]" or "Cantrip"
- **Monsters**: Pattern matches stat blocks with AC, HP, Speed
- **Items**: Pattern matches rarity keywords (uncommon, rare, legendary, etc.)

Extracted data is stored in the `StructuredData` Prisma model and searchable via `/api/search/quick?term=fireball&type=spell`.

## Schema Management

The Prisma schema is defined in `services/doc-api/prisma/schema.prisma`. **Important**: `services/doc-processor/prisma/schema.prisma` is a **symlink** to the doc-api schema to ensure consistency. Both services share the same database and schema.

When modifying the schema:
1. Edit only `services/doc-api/prisma/schema.prisma`
2. Run `npm run prisma:generate` in **both** doc-api and doc-processor
3. Run `npm run prisma:push` to apply changes to the database
4. Rebuild Docker images if needed

## Environment Variables

Each service requires a `.env` file (see `README.md` for full templates). Key variables:

**doc-api**:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection for BullMQ
- `ELASTICSEARCH_URL`: ElasticSearch endpoint
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`: S3 config
- `S3_FORCE_PATH_STYLE=true`: Required for MinIO

**doc-processor**:
- Same as doc-api (shares database, Redis, ElasticSearch, S3)

**doc-websocket**:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis for session storage
- `SESSION_TTL`: Session expiration time (seconds)

## Testing Strategy

- **Unit tests**: Test individual services, functions, and utilities
- **Integration tests**: Test API endpoints with real database (uses `docker-compose.test.yml`)
- **Smoke tests**: `test-stack.sh` validates all services are running and healthy
- **Manual testing**: Use curl commands from `README.md` or Postman

Unit tests are located in `__tests__` directories within each service's `src` folder.

## Admin API Endpoints

The doc-api service includes admin-specific endpoints for system management.

⚠️ **Note**: Authentication is currently **disabled** for development. All admin endpoints are publicly accessible without requiring JWT tokens or admin role. See the **Security Notes** section for details.

### Admin Document Management (`/api/admin/documents`)
- **GET** `/api/admin/documents` - List documents with enhanced filters (status, type, uploadedBy, date range, tags, pagination)
- **PATCH** `/api/admin/documents/:id` - Bulk update document metadata
- **DELETE** `/api/admin/documents/:id` - Delete document + S3 file + ElasticSearch entry
- **POST** `/api/admin/documents/:id/reprocess` - Retry failed document processing
- **GET** `/api/admin/stats` - System statistics (total docs, storage, queue stats, recent uploads)
- **GET** `/api/admin/validation/orphaned` - Find documents with missing S3 files
- **GET** `/api/admin/validation/metadata` - Find documents with inconsistent metadata
- **GET** `/api/admin/validation/elastic` - Find ElasticSearch inconsistencies
- **GET** `/api/admin/validation/comprehensive` - Run all validation checks

### Admin Queue Management (`/api/admin/queue`)
- **GET** `/api/admin/queue/stats` - Job counts by status (waiting, active, completed, failed)
- **GET** `/api/admin/queue/jobs` - List jobs with filters (status, limit, offset)
- **POST** `/api/admin/queue/jobs/:id/retry` - Retry specific failed job
- **DELETE** `/api/admin/queue/jobs/:id` - Remove job from queue
- **POST** `/api/admin/queue/clean` - Clean old completed/failed jobs
- **GET** `/api/admin/queue/jobs/:id/logs` - Get processing logs for a job (stored in Redis)

### Admin Search & Deduplication (`/api/admin/search`, `/api/admin/duplicates`)
- **POST** `/api/admin/search/advanced` - Multi-field search with faceted filtering (title, content, tags, type, date range, file size)
- **GET** `/api/admin/search/similar/:id` - Find similar documents by content hash or fuzzy title match
- **GET** `/api/admin/search/facets` - Get available filter options (types, tags, campaigns, uploaders)
- **GET** `/api/admin/duplicates` - List potential duplicates (exact, likely, possible confidence levels)
- **POST** `/api/admin/duplicates/merge` - Merge duplicate documents (keep one, delete others, merge metadata)
- **POST** `/api/admin/duplicates/preview-merge` - Preview merge operation without executing
- **GET** `/api/admin/duplicates/stats` - Get duplicate statistics and wasted storage

### Admin Bulk Operations
- **POST** `/api/admin/documents/bulk-update` - Update multiple documents (tags, campaigns, collections, type)
- **POST** `/api/admin/documents/bulk-delete` - Delete multiple documents with cleanup

### Admin Tag Management (`/api/admin/tags`)
- **GET** `/api/admin/tags` - List all tags with usage count, metadata, and sorting
- **POST** `/api/admin/tags` - Create tag metadata (category, color, description)
- **PATCH** `/api/admin/tags/:id` - Update tag metadata (rename updates all documents)
- **DELETE** `/api/admin/tags/:id` - Delete tag (remove from all documents with force option)
- **POST** `/api/admin/tags/merge` - Merge multiple tags into one
- **GET** `/api/admin/tags/unused` - Get tags with zero usage
- **DELETE** `/api/admin/tags/unused` - Delete all unused tags

### Admin Validation & Auto-Fix (`/api/admin/validation`)
- **GET** `/api/admin/validation/issues` - Find all data quality issues (missing titles, no tags, failed processing, stuck documents, invalid file sizes, duplicate titles)
- **POST** `/api/admin/validation/fix` - Auto-fix common issues (supports dry run mode)
- **GET** `/api/admin/validation/health` - Overall system health check with health score

### Key Admin Services

**content-hash.service.ts** (`services/doc-api/src/services/content-hash.service.ts`)
- Calculates SHA-256 hash of uploaded files
- Detects duplicate documents by content hash
- Provides merge functionality for duplicates
- Used for data quality and storage optimization

**logging.service.ts** (`services/doc-api/src/services/logging.service.ts`)
- Stores processing logs in Redis (with TTL)
- Retrieves logs for debugging failed jobs
- Accessible via admin API for troubleshooting

## Common Patterns

### Adding a New API Endpoint

1. Define route in `services/doc-api/src/routes/[resource].ts`
2. Use Zod schemas from `services/doc-api/src/types/` for validation
3. Call Prisma client via `services/doc-api/src/services/database.service.ts`
4. Return standardized JSON responses
5. Add integration tests in `services/doc-api/src/__tests__/`

### Adding a New Admin Endpoint

1. Define route in `services/doc-api/src/routes/admin/[resource].ts`
2. Use Zod schemas from `services/doc-api/src/types/admin.ts` for validation
3. Register admin routes in `services/doc-api/src/server.ts`
4. Return standardized JSON responses with error handling
5. Consider impact on admin-ui components
6. **Authentication**: Currently disabled for development. For production, add `{ preHandler: fastify.requireAdmin }` to the route options

### Adding a New WebSocket Event

1. Define event schema in `services/doc-websocket/src/types/events.ts`
2. Create handler in `services/doc-websocket/src/handlers/[category].handler.ts`
3. Register handler in `services/doc-websocket/src/websocket/server.ts`
4. Update README.md WebSocket Events section
5. Add tests in `services/doc-websocket/src/__tests__/`

### Adding a New Processing Step

1. Create service in `services/doc-processor/src/services/[name].service.ts`
2. Import and call in `services/doc-processor/src/workers/process-document.worker.ts`
3. Update document status enum in Prisma schema if needed
4. Add unit tests in `services/doc-processor/src/services/__tests__/`

### Adding an Admin UI Component

1. Create component in `services/admin-ui/src/components/`
2. Use shadcn/ui primitives and Tailwind for styling
3. Use TanStack Query for API data fetching
4. Follow existing patterns for error handling and loading states
5. Ensure responsive design (mobile/tablet support)

## Security Notes

⚠️ **IMPORTANT: Development Mode - Authentication Disabled** ⚠️

The admin interface authentication has been **temporarily disabled** for development convenience. All admin endpoints are currently publicly accessible without authentication.

### Current State (Development)

**Backend:**
- All `requireAdmin` preHandlers removed from admin routes
- `requireAdmin` decorator commented out in `server.ts`
- Admin endpoints accessible without JWT tokens

**Frontend:**
- `AuthContext` and `Login` page deleted
- All `Authorization` headers removed from API calls
- `ProtectedRoute` component removed
- Direct access to all admin pages without login

**Files Modified:**
- `services/doc-api/src/server.ts` - `requireAdmin` decorator commented out
- `services/doc-api/src/routes/admin/*.ts` - All `preHandler: fastify.requireAdmin` removed
- `services/admin-ui/src/contexts/AuthContext.tsx` - Deleted
- `services/admin-ui/src/pages/Login.tsx` - Deleted
- `services/admin-ui/src/App.tsx` - Authentication removed
- `services/admin-ui/src/pages/*.tsx` - Authorization headers removed

### Re-enabling Authentication for Production

To restore authentication for production deployment:

1. **Backend** (`services/doc-api/src/server.ts`):
   ```typescript
   // Uncomment the requireAdmin decorator (currently commented out)
   fastify.decorate('requireAdmin', async (request: any, reply: any) => {
     try {
       await request.jwtVerify();
       const { role } = request.user;
       if (role !== 'admin') {
         return reply.code(403).send({ error: 'Admin access required' });
       }
     } catch (err) {
       reply.code(401).send({ error: 'Unauthorized' });
     }
   });
   ```

2. **Admin Routes**: Add `{ preHandler: fastify.requireAdmin }` back to all admin endpoints:
   ```typescript
   fastify.get('/api/admin/health', { preHandler: fastify.requireAdmin }, async (...) => {...})
   ```

3. **Frontend**: Restore authentication files from git history:
   ```bash
   git checkout HEAD~N -- services/admin-ui/src/contexts/AuthContext.tsx
   git checkout HEAD~N -- services/admin-ui/src/pages/Login.tsx
   ```
   Then restore `Authorization` headers in all admin page API calls.

### Other Security Notes

- **ElasticSearch**: Currently `xpack.security.enabled=false` for development. **MUST** be enabled in production.
- **S3 URLs**: Pre-signed URLs expire (default: 1 hour). Clients must refresh if needed.
- **WebSocket Auth**: JWT token validation implemented but requires client to pass token in connection URL query parameter.
- **Docker**: Development `docker-compose.yml` uses weak credentials. Change in production.

## Production Deployment

### Google Cloud Platform (GCP)

NexusCodex is designed to run on GCP with minimal configuration changes. The AWS SDK's S3 client works seamlessly with Google Cloud Storage via the [S3 interoperability API](https://cloud.google.com/storage/docs/interoperability).

**Key GCP Services:**
- **Cloud SQL for PostgreSQL**: Managed PostgreSQL database (replaces local Docker PostgreSQL)
- **Memorystore for Redis**: Managed Redis service (replaces local Docker Redis)
- **Google Cloud Storage (GCS)**: Object storage with S3-compatible API (replaces MinIO)
- **Compute Engine / Cloud Run**: Container deployment for microservices
- **ElasticSearch**: Deploy on GCE VMs or use Elastic Cloud

**GCS S3 Interoperability Setup:**
1. Create a GCS bucket via `gsutil mb` or Console
2. Enable S3 interoperability in GCS settings
3. Generate HMAC keys (acts as S3 access key/secret)
4. Use endpoint `https://storage.googleapis.com` in production

**Environment Changes for GCP:**
```env
# Production .env (doc-api, doc-processor)
DATABASE_URL=postgresql://user:pass@<cloud-sql-ip>:5432/doclib
REDIS_URL=redis://<memorystore-ip>:6379
S3_ENDPOINT=https://storage.googleapis.com
S3_ACCESS_KEY=<gcs-hmac-access-key>
S3_SECRET_KEY=<gcs-hmac-secret>
S3_BUCKET=<your-gcs-bucket-name>
S3_REGION=us-central1  # or your GCS bucket region
S3_FORCE_PATH_STYLE=false  # GCS uses virtual-hosted-style URLs
```

**No code changes required** - the existing AWS SDK works with GCS out of the box.

See [DEPLOYMENT_GCP.md](../DEPLOYMENT_GCP.md) for step-by-step deployment instructions.

## File Structure Highlights

```
services/
├── doc-api/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── admin/      # Admin-specific endpoints
│   │   │   │   ├── documents.ts   # Document management, validation, bulk operations
│   │   │   │   ├── queue.ts       # Queue monitoring and management
│   │   │   │   ├── search.ts      # Advanced search and similarity
│   │   │   │   ├── duplicates.ts  # Deduplication and merge operations
│   │   │   │   ├── tags.ts        # Tag management and metadata
│   │   │   │   └── validation.ts  # Data quality validation and auto-fix
│   │   │   ├── documents.ts, search.ts, references.ts, annotations.ts, structured-data.ts, processing.ts
│   │   ├── services/       # Business logic
│   │   │   ├── s3.service.ts, database.service.ts, queue.service.ts, elastic.service.ts
│   │   │   ├── content-hash.service.ts  # Duplicate detection
│   │   │   └── logging.service.ts       # Processing logs
│   │   ├── types/          # Zod schemas & TypeScript types
│   │   │   ├── admin.ts    # Admin-specific types
│   │   │   └── document.ts, search.ts, etc.
│   │   └── server.ts       # Fastify app setup with admin routes
│   └── prisma/schema.prisma  # Master schema
├── doc-processor/
│   ├── src/
│   │   ├── services/
│   │   │   ├── pdf.service.ts, ocr.service.ts, markdown.service.ts, thumbnail.service.ts
│   │   │   ├── extraction.service.ts    # D&D content extraction
│   │   │   ├── elastic.service.ts
│   │   │   ├── content-hash.service.ts  # File hashing for duplicates
│   │   │   └── logging.service.ts       # Log processing steps
│   │   └── workers/        # BullMQ job handlers
│   └── prisma/schema.prisma  # Symlink to doc-api schema
├── doc-websocket/
│   ├── src/
│   │   ├── handlers/       # WebSocket event handlers (session, navigation, push, annotation)
│   │   ├── services/       # Redis, session management
│   │   └── websocket/      # WebSocket server setup
└── admin-ui/
    ├── src/
    │   ├── components/     # React components (shadcn/ui based)
    │   ├── pages/          # Route pages (Dashboard, Documents, Queue, etc.)
    │   ├── lib/            # Utilities and API client
    │   └── main.tsx        # Vite entry point
    ├── Dockerfile          # Multi-stage build (Vite build + nginx)
    └── package.json        # React, Vite, TailwindCSS, TanStack Query
```

## Troubleshooting

**Database connection errors**: Ensure `docker compose up` has fully started postgres (check `docker compose logs postgres`)

**Prisma client not found**: Run `npm run prisma:generate` in the service directory

**S3 upload failures**: Verify MinIO is running (`docker compose ps minio`) and credentials match `.env`

**ElasticSearch indexing fails**: Check ElasticSearch health (`curl http://localhost:9200/_cluster/health`), ensure index exists

**WebSocket disconnects**: Check Redis is running and `SESSION_TTL` is reasonable (default: 3600s)

**Docker build failures on macOS**: Set `export DOCKER_BUILDKIT=0` to use legacy builder (avoids permission issues)

## Implementation Status - Admin Interface

The admin interface implementation has **Phases 1-7 complete** with the following features:

### ✅ Phase 1: Foundation & Document Management (Complete)
- Admin UI service with React + Vite + TailwindCSS + shadcn/ui
- Document management endpoints in `/api/admin/documents`
- Document listing with filters (status, type, uploadedBy, date range, tags)
- Single document update, delete, and reprocess operations
- Dashboard with system statistics
- Validation endpoints (orphaned files, metadata issues, ElasticSearch inconsistencies)

### ✅ Phase 2: Processing Queue Management (Complete)
- Queue monitoring endpoints in `/api/admin/queue`
- Job listing with filters and status tracking
- Job retry and removal capabilities
- Clean old jobs functionality
- Processing logs stored in Redis via `logging.service.ts`
- Job log retrieval for debugging

### ✅ Phase 3: Search, Deduplication & Data Quality (Complete)
- **Advanced Search**: Multi-field search with ElasticSearch integration, faceted filtering, similarity search
- **Deduplication**: Content hash-based duplicate detection (exact, likely, possible matches)
- **Merge Operations**: Merge duplicate documents with metadata consolidation and preview
- **Duplicate Analytics**: Statistics on duplicate documents and wasted storage
- **Bulk Operations**: Bulk update and bulk delete for multiple documents
- **PostgreSQL Trigram Similarity**: Fuzzy title matching for "likely" duplicates

### ✅ Phase 4: Tag Management & Metadata Tools (Complete)
- **Tag Management System**: TagMetadata model for storing tag categories, colors, and descriptions
- **Tag Operations**: Create, update (with rename propagation), delete, merge tags
- **Tag Analytics**: Usage counts, unused tag detection, sorting by usage/name/category
- **Metadata Validation**: Comprehensive issue detection (missing titles, no tags, failed processing, stuck documents, invalid file sizes, duplicate titles)
- **Auto-Fix Functionality**: Automated fixes for common issues with dry-run support
- **Health Monitoring**: System health score based on document processing status

### ✅ Phase 5: User Management and Authentication (Implemented - Currently Disabled for Development)
- **JWT Authentication System**: Secure token-based authentication with access/refresh tokens (**Currently disabled - see Security Notes**)
- **User Management**: Full CRUD operations for user accounts via `/api/admin/users` endpoints
- **Role-Based Access Control**: Admin vs user roles with appropriate permissions (**Currently bypassed for development**)
- **WebSocket Authentication**: JWT token validation for real-time collaboration (implemented)
- **User Association**: Documents, annotations, and sessions properly linked to authenticated users
- **Admin UI Authentication**: Login/logout functionality with protected routes and user context (**Currently removed for development convenience**)

**Note**: The complete authentication system was implemented in Phase 5, but has been temporarily disabled for development purposes. All admin endpoints are currently publicly accessible. See the **Security Notes** section for details on the current state and how to re-enable authentication for production.

### ✅ Phase 6: Bulk Upload, Preview, and ElasticSearch Index Management (Complete)
- **Bulk Upload API**: Batch document uploads with progress tracking and error handling
- **File Type Detection**: Automatic MIME type and extension detection for uploaded files
- **Document Previews**: Thumbnail generation for images, text extraction for documents
- **Preview Endpoints**: Generate and retrieve file previews with metadata
- **ElasticSearch Management**: Index health monitoring, reindexing, and maintenance tools
- **Index Operations**: Recreate, optimize, clear, and monitor search indices
- **Admin UI Bulk Upload**: Drag-and-drop interface with batch processing and status tracking
- **ElasticSearch Dashboard**: Real-time index statistics and management interface

### ✅ Phase 7: System Health Monitoring and Performance Analytics (Complete)
- **System Health Monitoring**: Comprehensive health checks for all microservices (doc-api, doc-processor, doc-websocket, admin-ui, PostgreSQL, Redis, ElasticSearch, S3)
- **Health Service**: Real-time service status tracking with response time monitoring (`health.service.ts`)
- **Performance Metrics**: Collection of API, database, queue, storage, and search metrics (`metrics.service.ts`)
- **Metrics History**: Time-series data storage in Redis with configurable retention
- **Metrics Summaries**: Aggregated statistics over time periods (1h, 24h, 7d, 30d) with averages and peaks
- **Alert System**: Configurable alert rules for service health, performance thresholds, and resource usage (`alerts.service.ts`)
- **Alert Management**: Active alerts, alert history, acknowledgment, resolution, and cleanup
- **Alert Rules**: Customizable thresholds for response time, error rate, queue backlog, and storage usage
- **Alert Statistics**: Alert counts by severity and type with trend analysis
- **Admin Health Dashboard**: Real-time visualization of system status, metrics charts, and active alerts
- **Health API Endpoints**: 15+ endpoints in `/api/admin/health` for monitoring and metrics retrieval
- **Automated Monitoring**: Continuous background health checks with 30-second refresh intervals

### Key Services Implemented
- **content-hash.service.ts**: SHA-256 hashing, duplicate detection, merge functionality (auto-calculated during processing)
- **logging.service.ts**: Redis-backed processing logs with TTL
- **health.service.ts**: System-wide health monitoring for all services with response time tracking
- **metrics.service.ts**: Performance metrics collection, history tracking, and time-series aggregation
- **alerts.service.ts**: Alert rule engine, active alert management, and notification system
- **Admin search routes**: Advanced multi-field search with faceted results
- **Admin duplicates routes**: Duplicate detection, merge, and preview operations
- **Admin tag routes**: Tag metadata management with usage tracking
- **Admin validation routes**: Data quality checks and auto-fix capabilities
- **Admin health routes**: Health monitoring, metrics retrieval, and alert management endpoints

## Key Files to Review

- `docker-compose.yml`: Full service orchestration (includes admin-ui on port 3001)
- `services/doc-api/src/server.ts`: API entry point with all route registrations
- `services/doc-api/src/routes/admin/documents.ts`: Admin document management, validation, bulk operations
- `services/doc-api/src/routes/admin/queue.ts`: Admin queue management endpoints
- `services/doc-api/src/routes/admin/search.ts`: Advanced search and similarity endpoints
- `services/doc-api/src/routes/admin/duplicates.ts`: Deduplication and merge operations
- `services/doc-api/src/routes/admin/tags.ts`: Tag management and metadata operations
- `services/doc-api/src/routes/admin/validation.ts`: Data quality validation and auto-fix
- `services/doc-api/src/routes/admin/health.ts`: System health monitoring, metrics, and alerts endpoints
- `services/doc-api/src/services/content-hash.service.ts`: SHA-256 hashing and duplicate detection
- `services/doc-api/src/services/health.service.ts`: System-wide health checks and status monitoring
- `services/doc-api/src/services/metrics.service.ts`: Performance metrics collection and aggregation
- `services/doc-api/src/services/alerts.service.ts`: Alert rules engine and notification management
- `services/doc-processor/src/workers/process-document.worker.ts`: Core processing logic with content hash calculation
- `services/doc-websocket/src/websocket/server.ts`: WebSocket event routing
- `services/doc-api/prisma/schema.prisma`: Complete data models (includes contentHash and TagMetadata)
- `services/admin-ui/src/main.tsx`: Admin UI entry point
- `services/admin-ui/src/pages/Health.tsx`: Health monitoring dashboard UI
- `test-stack.sh`: Quick health check script
- `README.md`: Comprehensive API documentation and examples
