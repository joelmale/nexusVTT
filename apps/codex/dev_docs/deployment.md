# Deployment Guide

This guide covers deploying NexusCodex to production environments, with a focus on Google Cloud Platform (GCP) as the primary target platform.

## Production Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   API Service   │    │  WebSocket      │
│   (GCP LB)      │────│   (Cloud Run)   │    │  Service        │
│                 │    │                 │    │  (Cloud Run)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │  Document       │              │
         │              │  Processor      │              │
         │              │  (Cloud Run)    │              │
         └─────────────►│                 │◄─────────────┘
                        └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Databases     │
                    │ • Cloud SQL     │
                    │ • Memorystore   │
                    │ • Elastic Cloud │
                    │ • Cloud Storage │
                    └─────────────────┘
```

## Google Cloud Platform Deployment

### Prerequisites

1. **GCP Project** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Docker** installed locally
4. **Terraform** (optional, for infrastructure as code)

### Required GCP Services

- **Cloud SQL** (PostgreSQL)
- **Memorystore** (Redis)
- **Cloud Storage** (GCS)
- **Cloud Run** (Container runtime)
- **Load Balancer** (Traffic distribution)
- **Secret Manager** (Configuration secrets)
- **Cloud Build** (CI/CD)

### Infrastructure Setup

#### 1. Create GCP Project
```bash
# Set project
gcloud config set project your-project-id

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

#### 2. Cloud SQL (PostgreSQL)
```bash
# Create PostgreSQL instance
gcloud sql instances create nexus-codex-db \
  --database-version=POSTGRES_16 \
  --cpu=2 \
  --memory=4GB \
  --region=us-central1 \
  --root-password=your-root-password

# Create database
gcloud sql databases create doclib \
  --instance=nexus-codex-db

# Create user
gcloud sql users create nexus-user \
  --instance=nexus-codex-db \
  --password=your-user-password
```

#### 3. Memorystore (Redis)
```bash
# Create Redis instance
gcloud redis instances create nexus-cache \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0 \
  --tier=basic
```

#### 4. Cloud Storage
```bash
# Create bucket
gsutil mb -p your-project-id -c standard -l us-central1 gs://nexus-codex-documents/

# Enable versioning
gsutil versioning set on gs://nexus-codex-documents/

# Create HMAC keys for S3 compatibility
# Go to Cloud Storage > Settings > Interoperability
# Create access keys for service account
```

#### 5. Elastic Cloud (Optional)
```bash
# Use Elastic Cloud or deploy ElasticSearch on GCE
# For production, consider Elastic Cloud managed service
```

### Application Deployment

#### Environment Configuration

Create production environment files:

**services/doc-api/.env.production**
```bash
# Database
DATABASE_URL=postgresql://nexus-user:password@cloud-sql-ip:5432/doclib

# Redis
REDIS_URL=redis://memorystore-ip:6379

# ElasticSearch
ELASTICSEARCH_URL=https://elastic-cloud-url:9243

# S3 (GCS compatibility)
S3_ENDPOINT=https://storage.googleapis.com
S3_ACCESS_KEY=gcs-hmac-access-key
S3_SECRET_KEY=gcs-hmac-secret-key
S3_BUCKET=nexus-codex-documents
S3_REGION=us-central1
S3_FORCE_PATH_STYLE=false

# JWT (use Secret Manager)
JWT_SECRET=your-production-jwt-secret
JWT_REFRESH_SECRET=your-production-refresh-secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=8080
NODE_ENV=production
```

#### Docker Image Building

**services/doc-api/Dockerfile**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY dist/ ./dist/
COPY prisma/ ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify

USER fastify

EXPOSE 8080

CMD ["node", "dist/server.js"]
```

#### Cloud Run Deployment

```bash
# Build and push images
gcloud builds submit --tag gcr.io/your-project/nexus-codex-api
gcloud builds submit services/doc-processor --tag gcr.io/your-project/nexus-codex-processor
gcloud builds submit services/doc-websocket --tag gcr.io/your-project/nexus-codex-websocket

# Deploy API service
gcloud run deploy nexus-codex-api \
  --image gcr.io/your-project/nexus-codex-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --concurrency 80 \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "JWT_SECRET=jwt-secret:latest"

# Deploy processor service
gcloud run deploy nexus-codex-processor \
  --image gcr.io/your-project/nexus-codex-processor \
  --platform managed \
  --region us-central1 \
  --no-allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 5 \
  --concurrency 1

# Deploy WebSocket service
gcloud run deploy nexus-codex-websocket \
  --image gcr.io/your-project/nexus-codex-websocket \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --concurrency 100
```

#### Admin UI Deployment

**services/admin-ui/Dockerfile**
```dockerfile
# Build stage
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

```bash
# Build and deploy admin UI
gcloud builds submit services/admin-ui --tag gcr.io/your-project/nexus-codex-admin

gcloud run deploy nexus-codex-admin \
  --image gcr.io/your-project/nexus-codex-admin \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 80 \
  --memory 512Mi \
  --cpu 1
```

### Load Balancer Configuration

#### 1. Create Backend Services
```bash
# API backend
gcloud compute backend-services create nexus-api-backend \
  --protocol HTTP \
  --port-name http \
  --timeout 30s

# WebSocket backend
gcloud compute backend-services create nexus-ws-backend \
  --protocol HTTP \
  --port-name http \
  --timeout 3600s  # Long timeout for WebSocket

# Admin UI backend
gcloud compute backend-services create nexus-admin-backend \
  --protocol HTTP \
  --port-name http
```

#### 2. Create URL Map
```bash
# Create URL map for routing
gcloud compute url-maps create nexus-url-map \
  --default-service nexus-admin-backend

# Add path rules
gcloud compute url-maps add-path-matcher nexus-url-map \
  --path-matcher-name api-matcher \
  --default-service nexus-api-backend \
  --path-rules "/api/*=nexus-api-backend,/auth/*=nexus-api-backend"

gcloud compute url-maps add-path-matcher nexus-url-map \
  --path-matcher-name ws-matcher \
  --default-service nexus-ws-backend \
  --path-rules "/ws*=nexus-ws-backend"
```

#### 3. Create SSL Certificate
```bash
# Create managed SSL certificate
gcloud compute ssl-certificates create nexus-ssl-cert \
  --domains your-domain.com \
  --global

# Or use Let's Encrypt with cert-manager
```

#### 4. Create HTTPS Load Balancer
```bash
# Create target HTTPS proxy
gcloud compute target-https-proxies create nexus-https-proxy \
  --url-map nexus-url-map \
  --ssl-certificates nexus-ssl-cert

# Create forwarding rule
gcloud compute forwarding-rules create nexus-https-rule \
  --target-https-proxy nexus-https-proxy \
  --ports 443 \
  --global
```

### Database Migration

#### Production Database Setup
```bash
# Connect to Cloud SQL
gcloud sql connect nexus-codex-db --user=nexus-user

# Run migrations
cd services/doc-api
npx prisma migrate deploy

# Seed initial data
npx prisma db seed
```

### Monitoring and Logging

#### Cloud Monitoring
```bash
# Create uptime checks
gcloud monitoring uptime-check-configs create nexus-api-check \
  --display-name="Nexus Codex API" \
  --http-check-path="/" \
  --http-check-port=443 \
  --use-ssl \
  --resource-type=uptime-url \
  --host=your-domain.com

# Create alerts
gcloud monitoring alert-policies create nexus-api-alert \
  --display-name="API High Error Rate" \
  --condition="error_rate > 0.05" \
  --notification-channels=your-email-channel
```

#### Cloud Logging
```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision" \
  --filter "resource.labels.service_name=nexus-codex-api" \
  --limit 50

# Create log-based metrics
gcloud logging metrics create error-count \
  --description="Count of error logs" \
  --filter="severity>=ERROR" \
  --metric-kind=DELTA
```

### Backup Strategy

#### Database Backups
```bash
# Enable automated backups
gcloud sql instances patch nexus-codex-db \
  --backup-start-time 02:00

# Manual backup
gcloud sql backups create nexus-backup \
  --instance nexus-codex-db \
  --description "Manual backup"
```

#### File Storage Backups
```bash
# Cross-region replication
gsutil lifecycle set lifecycle.json gs://nexus-codex-documents/

# Versioning already enabled
gsutil ls -la gs://nexus-codex-documents/
```

### Security Configuration

#### Secret Management
```bash
# Store secrets in Secret Manager
echo "your-jwt-secret" | gcloud secrets create jwt-secret --data-file=-

# Access in Cloud Run
gcloud run services update nexus-codex-api \
  --set-secrets "JWT_SECRET=jwt-secret:latest"
```

#### IAM Configuration
```bash
# Create service accounts
gcloud iam service-accounts create nexus-api-sa \
  --description="Nexus Codex API Service Account"

# Grant permissions
gcloud projects add-iam-policy-binding your-project \
  --member="serviceAccount:nexus-api-sa@your-project.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding your-project \
  --member="serviceAccount:nexus-api-sa@your-project.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

### Performance Optimization

#### Cloud Run Configuration
```bash
# Optimize for cold starts
gcloud run services update nexus-codex-api \
  --min-instances 1 \
  --max-instances 20 \
  --concurrency 100 \
  --cpu-throttling

# Memory and CPU allocation
gcloud run services update nexus-codex-api \
  --memory 2Gi \
  --cpu 2
```

#### Database Optimization
```bash
# Connection pooling
# Configure in application with environment variables
CONNECTION_POOL_SIZE=10
CONNECTION_POOL_MAX_IDLE_TIME=30000
```

### CI/CD Pipeline

#### Cloud Build Configuration
**cloudbuild.yaml**
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/nexus-codex-api', 'services/doc-api']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/nexus-codex-api']

  - name: 'gcr.io/google-appengine/exec-wrapper'
    args: ['-c', 'gcloud run deploy nexus-codex-api --image gcr.io/$PROJECT_ID/nexus-codex-api --region us-central1 --platform managed']

options:
  logging: CLOUD_LOGGING_ONLY
```

#### GitHub Actions (Alternative)
```yaml
name: Deploy to GCP
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: google-github-actions/setup-gcloud@v1
      - uses: google-github-actions/get-gke-credentials@v1
      - run: |
          gcloud builds submit --config cloudbuild.yaml
```

### Cost Optimization

#### Resource Sizing
- **API Service**: 1-2 vCPU, 1-2GB RAM
- **Processor**: 2 vCPU, 2-4GB RAM (burstable)
- **WebSocket**: 1 vCPU, 512MB-1GB RAM
- **Admin UI**: 1 vCPU, 512MB RAM

#### Auto-scaling
```bash
# Configure based on CPU utilization
gcloud run services update nexus-codex-api \
  --cpu 1 \
  --memory 1Gi \
  --concurrency 80 \
  --max-instances 10
```

### Troubleshooting

#### Common Issues

**Cold Start Issues**
```bash
# Check instance count
gcloud run services describe nexus-codex-api --region us-central1

# Set minimum instances
gcloud run services update nexus-codex-api --min-instances 1
```

**Database Connection Issues**
```bash
# Check Cloud SQL connectivity
gcloud sql instances describe nexus-codex-db

# Verify connection string
gcloud sql instances list
```

**WebSocket Connection Issues**
```bash
# Check WebSocket service logs
gcloud logging read "resource.type=cloud_run_revision" \
  --filter "resource.labels.service_name=nexus-codex-websocket"
```

### Maintenance

#### Updates
```bash
# Update Cloud Run services
gcloud run services update nexus-codex-api \
  --image gcr.io/your-project/nexus-codex-api:new-version

# Rolling updates (zero downtime)
gcloud run services update-traffic nexus-codex-api \
  --to-revisions LATEST=100
```

#### Monitoring Dashboards
```bash
# Create custom dashboards
gcloud monitoring dashboards create nexus-dashboard \
  --config-from-file dashboard.json
```

This deployment guide provides a comprehensive production setup for NexusCodex on Google Cloud Platform. Adjust resource allocations and configurations based on your specific usage patterns and scaling requirements.