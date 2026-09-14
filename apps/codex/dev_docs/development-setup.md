# Development Setup

This guide covers setting up the NexusCodex development environment on your local machine.

## Prerequisites

### System Requirements
- **Node.js**: 20.x or later
- **Docker**: 24.x or later
- **Docker Compose**: 2.x or later
- **Git**: 2.x or later

### Recommended Tools
- **VS Code** with TypeScript and React extensions
- **Postman** or **Insomnia** for API testing
- **DBeaver** or **pgAdmin** for database management
- **Elasticvue** for ElasticSearch management

## Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd nexus-codex
```

### 2. Start Development Environment
```bash
# Start all services (PostgreSQL, Redis, ElasticSearch, MinIO)
docker compose up --build -d

# Check service status
docker compose ps
```

### 3. Install Dependencies
```bash
# Install dependencies for all services
cd services/doc-api && npm install
cd ../doc-processor && npm install
cd ../doc-websocket && npm install
cd ../admin-ui && npm install
```

### 4. Database Setup
```bash
# Generate Prisma client and push schema
cd services/doc-api
npm run prisma:generate
npm run prisma:push
```

### 5. Start Development Servers
```bash
# Terminal 1: API Server
cd services/doc-api && npm run dev

# Terminal 2: Document Processor
cd services/doc-processor && npm run dev

# Terminal 3: WebSocket Server
cd services/doc-websocket && npm run dev

# Terminal 4: Admin UI
cd services/admin-ui && npm run dev
```

### 6. Access Applications
- **Admin UI**: http://localhost:3001
- **API Documentation**: http://localhost:3000
- **MinIO Console**: http://localhost:9001 (admin/password)
- **pgAdmin**: http://localhost:5050 (admin@example.com/admin)

## Detailed Setup

## Environment Configuration

### API Service (.env)
```bash
# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/doclib

# Redis
REDIS_URL=redis://redis:6379

# ElasticSearch
ELASTICSEARCH_URL=http://elasticsearch:9200

# S3 Storage
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=admin
S3_SECRET_KEY=password
S3_BUCKET=documents
S3_FORCE_PATH_STYLE=true

# JWT
JWT_SECRET=your-development-jwt-secret-key
JWT_REFRESH_SECRET=your-development-refresh-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=development
```

### Processor Service (.env)
```bash
# Shared infrastructure
DATABASE_URL=postgresql://user:pass@postgres:5432/doclib
REDIS_URL=redis://redis:6379
ELASTICSEARCH_URL=http://elasticsearch:9200
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=admin
S3_SECRET_KEY=password
S3_BUCKET=documents
S3_FORCE_PATH_STYLE=true

# Processing
WORKER_CONCURRENCY=2
MAX_FILE_SIZE=100MB
```

### WebSocket Service (.env)
```bash
DATABASE_URL=postgresql://user:pass@postgres:5432/doclib
REDIS_URL=redis://redis:6379
PORT=3002
SESSION_TTL=3600
NODE_ENV=development
```

### Admin UI (.env)
```bash
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3002/ws
```

## Database Management

### Prisma Commands
```bash
cd services/doc-api

# Generate Prisma client
npm run prisma:generate

# Push schema changes (development)
npm run prisma:push

# Create migration (production)
npm run prisma:migrate dev

# Open Prisma Studio
npm run prisma:studio
```

### Database Seeding

#### Create Initial Admin User
```bash
# Via API (after services are running)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "admin123",
    "displayName": "Administrator"
  }'

# Promote to admin (in database)
docker compose exec postgres psql -U user -d doclib \
  -c "UPDATE users SET role = 'admin' WHERE username = 'admin';"
```

#### Sample Data
```sql
-- Insert sample document
INSERT INTO documents (title, type, format, storage_key, file_size, uploaded_by)
VALUES ('Player Handbook', 'rulebook', 'pdf', 'documents/phb.pdf', 10485760, 'admin');

-- Insert sample tags
INSERT INTO tag_metadata (name, category, color, description)
VALUES
  ('combat', 'system', '#FF5733', 'Combat-related content'),
  ('spells', 'content', '#33FF57', 'Spell descriptions'),
  ('monsters', 'content', '#3357FF', 'Monster stat blocks');
```

## Testing

### Unit Tests
```bash
# API Service
cd services/doc-api && npm test

# Processor Service
cd services/doc-processor && npm test

# WebSocket Service
cd services/doc-websocket && npm test
```

### Integration Tests
```bash
# Run all integration tests
cd services/doc-api && npm run test:integration
```

### End-to-End Tests
```bash
# Full stack test
./run-tests.sh all
```

### Health Check
```bash
# Quick health check
./test-stack.sh
```

## Development Workflow

### Code Changes
1. **Make changes** in your feature branch
2. **Run tests** to ensure functionality
3. **Check linting** and type checking
4. **Test integration** with other services
5. **Submit PR** with clear description

### Adding New Features

#### API Endpoint
1. **Define route** in appropriate `routes/*.ts` file
2. **Add service method** in `services/*.service.ts`
3. **Update types** in `types/*.ts`
4. **Add tests** in `__tests__/` directory
5. **Update documentation**

#### Database Changes
1. **Update Prisma schema** in `services/doc-api/prisma/schema.prisma`
2. **Generate migration**: `npm run prisma:migrate dev`
3. **Update service code** to use new fields
4. **Test data integrity**

#### UI Components
1. **Create component** in `services/admin-ui/src/components/`
2. **Add to routing** if needed
3. **Style with Tailwind** and shadcn/ui
4. **Test responsiveness**

### Debugging

#### API Debugging
```bash
# Enable debug logging
DEBUG=fastify:* npm run dev

# Check API logs
docker compose logs doc-api -f
```

#### Database Debugging
```bash
# Connect to database
docker compose exec postgres psql -U user -d doclib

# View recent queries
SELECT * FROM pg_stat_activity;
```

#### WebSocket Debugging
```bash
# WebSocket server logs
docker compose logs doc-websocket -f

# Test connection
wscat -c "ws://localhost:3002/ws?token=YOUR_JWT_TOKEN"
```

## Common Issues

### Services Won't Start
```bash
# Check Docker resources
docker system df

# Clean up and restart
docker compose down -v
docker compose up --build
```

### Database Connection Issues
```bash
# Check database status
docker compose ps postgres

# Reset database
docker compose down -v
docker compose up postgres -d
cd services/doc-api && npm run prisma:push
```

### Port Conflicts
```bash
# Check what's using ports
lsof -i :3000
lsof -i :3001
lsof -i :3002

# Change ports in docker-compose.yml or .env files
```

### Memory Issues
```bash
# Increase Docker memory limit
# Docker Desktop: Settings > Resources > Memory

# Monitor resource usage
docker stats
```

## Performance Optimization

### Development Performance
```bash
# Use faster package manager
npm install --prefer-offline

# Enable hot reload
# Already configured in package.json scripts
```

### Database Performance
```bash
# Analyze slow queries
EXPLAIN ANALYZE SELECT * FROM documents WHERE uploaded_by = 'user';

# Check indexes
SELECT * FROM pg_indexes WHERE tablename = 'documents';
```

### Build Performance
```bash
# Use build cache
docker build --cache-from nexus-codex:latest .

# Parallel builds
docker compose build --parallel
```

## Deployment

### Local Production Test
```bash
# Build production images
docker compose -f docker-compose.yml build

# Test production setup
docker compose -f docker-compose.yml up
```

### Staging Deployment
```bash
# Use staging configuration
docker compose -f docker-compose.staging.yml up
```

## Contributing Guidelines

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for consistency
- **Prettier**: For code formatting
- **Conventional Commits**: For commit messages

### Testing Requirements
- **Unit tests**: >80% coverage
- **Integration tests**: All API endpoints
- **E2E tests**: Critical user flows

### Documentation
- **Code comments**: For complex logic
- **API docs**: OpenAPI/Swagger format
- **README updates**: For new features

## Support

### Getting Help
1. **Check logs**: `docker compose logs [service]`
2. **Search issues**: GitHub issues
3. **Community**: Discord/Slack channels
4. **Documentation**: This dev docs

### Reporting Issues
- **Bug reports**: Include logs, steps to reproduce
- **Feature requests**: Describe use case and benefits
- **Performance issues**: Include metrics and profiling data