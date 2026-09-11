# Configuration

NexusCodex uses environment variables for configuration across all services. This document covers all available configuration options.

## Environment Files

Each service has its own `.env` file. Copy from `.env.example` and customize for your environment.

### Development Setup
```bash
# Copy example files
cp services/doc-api/.env.example services/doc-api/.env
cp services/doc-processor/.env.example services/doc-processor/.env
cp services/doc-websocket/.env.example services/doc-websocket/.env
cp services/admin-ui/.env.example services/admin-ui/.env
```

## API Service Configuration

### Database
```bash
# PostgreSQL connection string
DATABASE_URL=postgresql://user:pass@localhost:5432/doclib

# Connection pool settings
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_POOL_IDLE_TIMEOUT=30000
DATABASE_POOL_ACQUIRE_TIMEOUT=60000
```

### Redis
```bash
# Redis connection for BullMQ job queue
REDIS_URL=redis://localhost:6379

# Redis connection pool
REDIS_POOL_MIN=1
REDIS_POOL_MAX=5
REDIS_POOL_IDLE_TIMEOUT=30000
```

### ElasticSearch
```bash
# ElasticSearch cluster URL
ELASTICSEARCH_URL=http://localhost:9200

# Index settings
ELASTICSEARCH_INDEX_PREFIX=nexus_
ELASTICSEARCH_INDEX_SHARDS=1
ELASTICSEARCH_INDEX_REPLICAS=0

# Connection settings
ELASTICSEARCH_REQUEST_TIMEOUT=30000
ELASTICSEARCH_PING_TIMEOUT=3000
ELASTICSEARCH_MAX_RETRIES=3
```

### S3 Storage
```bash
# S3-compatible storage endpoint
S3_ENDPOINT=http://localhost:9000

# Authentication
S3_ACCESS_KEY=admin
S3_SECRET_KEY=password

# Bucket configuration
S3_BUCKET=documents
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true

# Upload settings
S3_UPLOAD_TIMEOUT=300000
S3_MAX_FILE_SIZE=104857600  # 100MB
S3_PRESIGNED_URL_EXPIRES=3600  # 1 hour
```

### JWT Authentication
```bash
# JWT signing secrets (use strong, random values)
JWT_SECRET=your-jwt-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here

# Token expiration
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Issuer and audience (optional)
JWT_ISSUER=nexus-codex
JWT_AUDIENCE=nexus-codex-api
```

### Server Configuration
```bash
# Server port
PORT=3000

# Environment
NODE_ENV=development

# Logging
LOG_LEVEL=info
LOG_PRETTY=true

# CORS
CORS_ORIGIN=http://localhost:3001
CORS_CREDENTIALS=true

# Rate limiting
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

### File Processing
```bash
# Processing settings
MAX_FILE_SIZE=104857600  # 100MB
ALLOWED_FILE_TYPES=pdf,markdown,txt,html
THUMBNAIL_SIZE=300x400
THUMBNAIL_QUALITY=80

# OCR settings
OCR_ENABLED=true
OCR_LANGUAGES=eng
OCR_TIMEOUT=30000
```

## Processor Service Configuration

### Job Processing
```bash
# Worker concurrency
WORKER_CONCURRENCY=2

# Job settings
JOB_MAX_RETRIES=3
JOB_BACKOFF_DELAY=5000
JOB_REMOVE_ON_COMPLETE=100
JOB_REMOVE_ON_FAIL=50

# Processing timeouts
PDF_PROCESS_TIMEOUT=60000
OCR_PROCESS_TIMEOUT=120000
THUMBNAIL_TIMEOUT=30000
```

### Content Extraction
```bash
# Text extraction
EXTRACT_TEXT_MAX_LENGTH=1000000
EXTRACT_TEXT_ENCODING=utf8

# Structured data patterns
SPELL_PATTERN_KEYWORDS=level,cantrip,spell
MONSTER_PATTERN_KEYWORDS=armor class,hit points,speed
ITEM_PATTERN_KEYWORDS=weapon,armor,potion,rare

# Content hashing
CONTENT_HASH_ALGORITHM=sha256
CONTENT_HASH_SAMPLE_SIZE=1048576  # 1MB sample
```

## WebSocket Service Configuration

### Server Settings
```bash
# WebSocket server port
PORT=3002

# Connection settings
WS_HEARTBEAT_INTERVAL=30000
WS_CONNECTION_TIMEOUT=10000
WS_MAX_CONNECTIONS=1000
```

### Session Management
```bash
# Redis session storage
SESSION_TTL=3600  # 1 hour
SESSION_CLEANUP_INTERVAL=300000  # 5 minutes

# Session limits
MAX_SESSIONS_PER_USER=5
MAX_PARTICIPANTS_PER_SESSION=20
```

### Event Handling
```bash
# Event validation
EVENT_VALIDATION_ENABLED=true
EVENT_MAX_SIZE=65536  # 64KB

# Rate limiting
EVENT_RATE_LIMIT_WINDOW=60000  # 1 minute
EVENT_RATE_LIMIT_MAX=100
```

## Admin UI Configuration

### API Connection
```bash
# API base URL
VITE_API_URL=http://localhost:3000

# WebSocket URL
VITE_WS_URL=ws://localhost:3002/ws
```

### Feature Flags
```bash
# Enable/disable features
VITE_ENABLE_DEBUG_MODE=false
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_PWA=false
```

### UI Configuration
```bash
# Theme settings
VITE_DEFAULT_THEME=light
VITE_ENABLE_DARK_MODE=true

# Pagination
VITE_DEFAULT_PAGE_SIZE=20
VITE_MAX_PAGE_SIZE=100
```

## Docker Compose Configuration

### Development Services
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: doclib
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes

  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  minio:
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: password
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
```

### Production Overrides
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  doc-api:
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=warn
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.5'
```

## Security Configuration

### Password Policies
```bash
# Password requirements
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SYMBOLS=false

# Account security
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION=900000  # 15 minutes
PASSWORD_RESET_TOKEN_EXPIRES=3600000  # 1 hour
```

### Session Security
```bash
# Session settings
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTP_ONLY=true
SESSION_COOKIE_SAME_SITE=strict

# CSRF protection
CSRF_ENABLED=true
CSRF_SECRET=your-csrf-secret
```

### API Security
```bash
# API key authentication (optional)
API_KEY_ENABLED=false
API_KEY_HEADER=X-API-Key

# Request validation
REQUEST_VALIDATION_ENABLED=true
REQUEST_SIZE_LIMIT=10485760  # 10MB

# CORS settings
CORS_ALLOWED_ORIGINS=https://yourdomain.com
CORS_ALLOWED_METHODS=GET,POST,PUT,PATCH,DELETE
CORS_ALLOWED_HEADERS=Content-Type,Authorization,X-API-Key
```

## Monitoring Configuration

### Health Checks
```bash
# Health check endpoints
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_DATABASE=true
HEALTH_CHECK_REDIS=true
HEALTH_CHECK_ELASTICSEARCH=true
HEALTH_CHECK_S3=true

# Health check intervals
HEALTH_CHECK_INTERVAL=30000  # 30 seconds
HEALTH_CHECK_TIMEOUT=5000    # 5 seconds
```

### Metrics Collection
```bash
# Prometheus metrics
METRICS_ENABLED=true
METRICS_PORT=9090
METRICS_PATH=/metrics

# Custom metrics
METRICS_DOCUMENT_UPLOADS=true
METRICS_SEARCH_QUERIES=true
METRICS_WEBSOCKET_CONNECTIONS=true
```

### Logging Configuration
```bash
# Log levels
LOG_LEVEL=info
LOG_FORMAT=json

# Log aggregation
LOG_SENTRY_DSN=your-sentry-dsn
LOG_DATADOG_API_KEY=your-datadog-key

# Log retention
LOG_MAX_FILES=10
LOG_MAX_SIZE=10m
```

## Performance Tuning

### Database Optimization
```bash
# Connection pooling
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000

# Query optimization
DB_SLOW_QUERY_THRESHOLD=1000  # ms
DB_ENABLE_QUERY_LOGGING=true

# Caching
DB_CACHE_ENABLED=true
DB_CACHE_TTL=3600000  # 1 hour
```

### Cache Configuration
```bash
# Redis cache settings
CACHE_DEFAULT_TTL=3600
CACHE_KEY_PREFIX=nexus:

# Cache strategies
CACHE_STRATEGY=lru
CACHE_MAX_MEMORY=512mb
```

### CDN Configuration
```bash
# Static asset CDN
CDN_ENABLED=true
CDN_URL=https://cdn.yourdomain.com
CDN_THUMBNAILS=true
CDN_DOCUMENTS=false  # Keep documents private

# Cache headers
CDN_CACHE_CONTROL=max-age=31536000  # 1 year
CDN_THUMBNAIL_CACHE=max-age=86400   # 1 day
```

## Feature Flags

### Experimental Features
```bash
# Enable/disable experimental features
FEATURE_ADVANCED_SEARCH=true
FEATURE_REAL_TIME_COLLABORATION=true
FEATURE_BULK_OPERATIONS=true
FEATURE_DOCUMENT_ANNOTATIONS=true
FEATURE_OFFLINE_MODE=false
```

### Beta Features
```bash
# Beta feature toggles
BETA_AI_CONTENT_EXTRACTION=false
BETA_ADVANCED_PERMISSIONS=false
BETA_INTEGRATION_APIS=false
```

## Third-party Integrations

### Email Configuration
```bash
# SMTP settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Email templates
EMAIL_FROM=noreply@yourdomain.com
EMAIL_TEMPLATES_PATH=./templates
```

### Analytics
```bash
# Google Analytics
GA_TRACKING_ID=GA-XXXXXXXXX

# Mixpanel
MIXPANEL_TOKEN=your-mixpanel-token

# Custom analytics
ANALYTICS_ENDPOINT=https://analytics.yourdomain.com
```

### External APIs
```bash
# OCR service
OCR_API_URL=https://api.ocr.space
OCR_API_KEY=your-ocr-api-key

# Content analysis
CONTENT_API_URL=https://api.content.ai
CONTENT_API_KEY=your-content-api-key
```

## Environment-specific Overrides

### Development
```bash
# Relaxed security for development
NODE_ENV=development
LOG_LEVEL=debug
CORS_ORIGIN=*
JWT_EXPIRES_IN=24h
```

### Staging
```bash
# Pre-production settings
NODE_ENV=staging
LOG_LEVEL=info
CORS_ORIGIN=https://staging.yourdomain.com
```

### Production
```bash
# Strict production settings
NODE_ENV=production
LOG_LEVEL=warn
CORS_ORIGIN=https://yourdomain.com
JWT_SECRET=production-secret-from-secrets-manager
```

## Configuration Validation

### Required Environment Variables
```typescript
const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'ELASTICSEARCH_URL',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

// Validate on startup
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
});
```

### Configuration Schema Validation
```typescript
import { z } from 'zod';

const configSchema = z.object({
  port: z.number().int().positive().default(3000),
  database: z.object({
    url: z.string().url(),
    poolMin: z.number().int().min(1).default(2),
    poolMax: z.number().int().min(1).default(10)
  }),
  jwt: z.object({
    secret: z.string().min(32),
    refreshSecret: z.string().min(32),
    expiresIn: z.string(),
    refreshExpiresIn: z.string()
  })
});

export const config = configSchema.parse({
  port: parseInt(process.env.PORT || '3000'),
  database: {
    url: process.env.DATABASE_URL!,
    poolMin: parseInt(process.env.DATABASE_POOL_MIN || '2'),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX || '10')
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  }
});
```

This configuration system provides flexibility for different deployment environments while maintaining type safety and validation.