# Nexus VTT + NexusCodex Integrated Setup

This guide explains how to run Nexus VTT with the integrated NexusCodex document library system.

## Architecture Overview

The integrated system combines:
- **Nexus VTT**: Virtual tabletop (frontend + backend)
- **NexusCodex**: Document management services (doc-api, doc-processor, doc-websocket)
- **Shared Infrastructure**: PostgreSQL, Redis, MinIO (S3), ElasticSearch

```
┌─────────────────────────────────────────────────────┐
│         Nexus VTT Frontend (:5173)                  │
└──────────┬──────────────────────────────────────────┘
           │
           ├───────────┬────────────────┬─────────────┐
           │           │                │             │
           ▼           ▼                ▼             ▼
    ┌──────────┐ ┌──────────┐  ┌──────────────┐ ┌────────────┐
    │ VTT      │ │ doc-api  │  │doc-websocket │ │   MinIO    │
    │ Backend  │ │  :3000   │  │    :3002     │ │  Console   │
    │  :5001   │ └──────────┘  └──────────────┘ │   :9001    │
    └──────────┘       │                │        └────────────┘
           │           │                │
           └───────────┴────────────────┴──────────────┐
                                                        │
                         ┌──────────────────────────────┘
                         │
         ┌───────────────┼───────────────────┬─────────────────┐
         │               │                   │                 │
         ▼               ▼                   ▼                 ▼
    ┌─────────┐    ┌─────────┐      ┌──────────────┐  ┌──────────────┐
    │PostgreSQL│    │  Redis  │      │doc-processor │  │ElasticSearch │
    │  :5432  │    │  :6379  │      │  (worker)    │  │    :9200     │
    └─────────┘    └─────────┘      └──────────────┘  └──────────────┘
```

## Prerequisites

- Docker Desktop or Docker Engine with Docker Compose v2+
- Node.js 26.5+ (for local development outside Docker)
- Git
- 8GB+ RAM recommended (ElasticSearch is memory-intensive)

## Directory Structure

This setup assumes both repositories are in parallel directories:

```
Coding/
├── nexus/              # Nexus VTT repository (this repo)
└── NexusCodex/         # NexusCodex repository (document services)
```

## Quick Start

### 1. Clone Both Repositories

```bash
cd ~/Coding

# Clone Nexus VTT (if not already cloned)
git clone <nexus-vtt-repo-url> nexus
cd nexus

# Clone NexusCodex in parallel directory
cd ~/Coding
git clone <nexus-codex-repo-url> NexusCodex
```

### 2. Configure Environment Variables

Create `.env.local` in the Nexus VTT root:

```bash
# Nexus VTT
DATABASE_URL=postgresql://nexus:password@localhost:5432/nexus
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
SESSION_SECRET=your-session-secret

# NexusCodex Document Services (accessed from browser)
VITE_DOC_API_URL=http://localhost:3000
VITE_DOC_WS_URL=ws://localhost:3002
```

### 3. Start All Services

```bash
cd ~/Coding/nexus

# Start entire integrated stack
docker compose -f docker-compose.integrated.yml up -d

# Watch logs
docker compose -f docker-compose.integrated.yml logs -f
```

### 4. Wait for Services to be Healthy

```bash
# Check service health (wait ~60 seconds for all services)
docker compose -f docker-compose.integrated.yml ps
```

All services should show "healthy" or "running":
- ✅ postgres (healthy)
- ✅ redis (running)
- ✅ elasticsearch (healthy)
- ✅ minio (healthy)
- ✅ vtt-backend (running)
- ✅ vtt-frontend (running)
- ✅ doc-api (running)
- ✅ doc-processor (running)
- ✅ doc-websocket (running)

### 5. Initialize Databases

```bash
# Initialize Nexus VTT database schema
docker compose -f docker-compose.integrated.yml exec vtt-backend npm run prisma:push

# Initialize NexusCodex database schema
docker compose -f docker-compose.integrated.yml exec doc-api npm run prisma:push

# Create MinIO bucket
docker compose -f docker-compose.integrated.yml exec minio sh -c "
  mc alias set local http://localhost:9000 admin password &&
  mc mb local/documents --ignore-existing &&
  mc anonymous set download local/documents
"
```

### 6. Access the Application

| Service | URL | Description |
|---------|-----|-------------|
| **Nexus VTT** | http://localhost:5173 | Main VTT interface |
| **VTT Backend** | http://localhost:5001 | WebSocket + API server |
| **Document API** | http://localhost:3000 | REST API for documents |
| **Document WS** | ws://localhost:3002 | Real-time doc collaboration |
| **MinIO Console** | http://localhost:9001 | S3 storage (login: admin/password) |
| **ElasticSearch** | http://localhost:9200 | Search API (direct access) |
| **Asset Server** | http://localhost:8081 | Static assets (maps, tokens) |

## Development Workflow

### Hot Reload

Both Nexus VTT and NexusCodex services support hot reload:
- Frontend: Changes to `src/` auto-reload browser
- Backend: Changes to `server/` auto-restart server
- Document services: Changes to `services/*/src/` auto-restart

### Viewing Logs

```bash
# All services
docker compose -f docker-compose.integrated.yml logs -f

# Specific service
docker compose -f docker-compose.integrated.yml logs -f doc-api
docker compose -f docker-compose.integrated.yml logs -f vtt-backend
docker compose -f docker-compose.integrated.yml logs -f doc-processor
```

### Restarting Services

```bash
# Restart specific service
docker compose -f docker-compose.integrated.yml restart doc-api

# Rebuild after dependency changes
docker compose -f docker-compose.integrated.yml up -d --build doc-api
```

### Database Access

```bash
# Connect to PostgreSQL
docker compose -f docker-compose.integrated.yml exec postgres psql -U nexus -d nexus

# Or for documents database
docker compose -f docker-compose.integrated.yml exec postgres psql -U nexus -d nexus_docs

# View Nexus VTT data
docker compose -f docker-compose.integrated.yml exec vtt-backend npm run prisma:studio

# View NexusCodex data
docker compose -f docker-compose.integrated.yml exec doc-api npm run prisma:studio
```

### Redis Access

```bash
# Connect to Redis CLI
docker compose -f docker-compose.integrated.yml exec redis redis-cli

# View all keys
docker compose -f docker-compose.integrated.yml exec redis redis-cli KEYS '*'

# Monitor commands
docker compose -f docker-compose.integrated.yml exec redis redis-cli MONITOR
```

## Stopping Services

```bash
# Stop all services (keep data)
docker compose -f docker-compose.integrated.yml down

# Stop and remove volumes (DELETES ALL DATA)
docker compose -f docker-compose.integrated.yml down -v
```

## Troubleshooting

### ElasticSearch fails to start (out of memory)

ElasticSearch requires significant memory. If it fails:

```bash
# Increase Docker memory to 6GB+ in Docker Desktop settings
# Or reduce ES memory in docker-compose.integrated.yml:
# ES_JAVA_OPTS=-Xms256m -Xmx256m
```

### Port conflicts

If ports are already in use:

```bash
# Check what's using ports
lsof -i :5173 # Frontend
lsof -i :5001 # VTT Backend
lsof -i :3000 # doc-api
lsof -i :3002 # doc-websocket

# Change ports in docker-compose.integrated.yml
```

### NexusCodex services fail to build

Ensure the NexusCodex directory is in the correct location:

```bash
# Should be: ~/Coding/NexusCodex/
# NOT: ~/Coding/nexus/NexusCodex/

# Fix with symbolic link if needed
cd ~/Coding/nexus
ln -s ../NexusCodex NexusCodex
```

### Database migrations fail

```bash
# Reset Nexus VTT database
docker compose -f docker-compose.integrated.yml exec postgres dropdb -U nexus nexus --if-exists
docker compose -f docker-compose.integrated.yml exec postgres createdb -U nexus nexus
docker compose -f docker-compose.integrated.yml exec vtt-backend npm run prisma:push

# Reset NexusCodex database
docker compose -f docker-compose.integrated.yml exec postgres dropdb -U nexus nexus_docs --if-exists
docker compose -f docker-compose.integrated.yml exec postgres createdb -U nexus nexus_docs
docker compose -f docker-compose.integrated.yml exec doc-api npm run prisma:push
```

## Testing the Integration

### 1. Test Nexus VTT

1. Navigate to http://localhost:5173
2. Login with Google OAuth
3. Create a campaign from Dashboard
4. Start a session
5. Verify WebSocket connection

### 2. Test Document Upload

```bash
# Create a test document
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Document",
    "description": "Integration test",
    "type": "rulebook",
    "format": "pdf",
    "uploadedBy": "test-user",
    "fileSize": 1024,
    "fileName": "test.pdf",
    "tags": ["test"],
    "campaigns": []
  }'
```

### 3. Test Search

```bash
# Full-text search
curl "http://localhost:3000/api/search?query=test"

# Quick search
curl "http://localhost:3000/api/search/quick?term=test&type=spell"
```

### 4. Test WebSocket

```javascript
// In browser console at http://localhost:5173
const ws = new WebSocket('ws://localhost:3002/ws');
ws.onopen = () => console.log('✅ Document WebSocket connected');
ws.onmessage = (e) => console.log('📨 Message:', e.data);
ws.onerror = (e) => console.error('❌ WS Error:', e);
```

## Production Deployment

For production deployment:

1. Use separate docker-compose.prod.yml
2. Enable ElasticSearch security
3. Use production PostgreSQL (Cloud SQL, RDS)
4. Use production object storage (GCS, S3, R2)
5. Configure proper OAuth callbacks
6. Set strong secrets and passwords
7. Enable HTTPS/WSS

See `DEPLOYMENT.md` for detailed production setup.

## Architecture Notes

### Why Microservices?

NexusCodex runs as separate services for:
- **Separation of concerns**: VTT and documents are independent
- **Scalability**: Scale doc-processor workers independently
- **Technology flexibility**: Use different tech stacks if needed
- **Fault isolation**: Document service issues don't crash VTT

### Shared Resources

PostgreSQL and Redis are shared because:
- **Cost efficiency**: One DB for dev/testing
- **Cross-service queries**: Can join VTT + document data
- **Session sharing**: Unified authentication

In production, you can separate them if needed.

---

## Next Steps

After setup is working:

1. **Explore the Dashboard**: Navigate to `/dashboard` after logging in
2. **Upload Documents**: Use the Library tab to upload PDF rulebooks
3. **Test Search**: Try searching for D&D terms
4. **Start a Game**: Create a session and open documents during gameplay
5. **Build UI**: Follow `INTEGRATION_PLAN.md` to build the document viewer components

---

For questions or issues, see:
- NexusCodex Documentation: `/NexusCodex/README.md`
- Nexus VTT Documentation: `/README.md`
- Integration Plan: `/INTEGRATION_PLAN.md`
