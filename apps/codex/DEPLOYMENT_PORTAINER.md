# NexusCodex - Portainer Deployment Guide

This guide covers deploying NexusCodex to a Docker Swarm cluster managed by Portainer, using pre-built images from GitHub Container Registry (GHCR).

---

## 📋 Prerequisites

- Docker Swarm cluster (1+ nodes)
- Portainer installed and configured
- GitHub account with NexusCodex repository
- Domain name (optional, for production URLs)

---

## 🚀 Deployment Strategy: GitHub Actions → GHCR → Portainer

**Flow:**
```
Code Push → GitHub Actions → Build Images → Push to GHCR → Portainer Pulls → Deploy to Swarm
```

**Why This Approach:**
- ✅ Build once, deploy many times
- ✅ Fast deployments (pre-built images)
- ✅ Production safety (failed builds don't affect prod)
- ✅ Easy rollbacks (versioned images)
- ✅ No build resources needed on production servers

---

## Step 1: Enable GitHub Actions

The repository includes a GitHub Actions workflow at `.github/workflows/build-and-push.yml`.

### What It Does:
- Builds all 5 services (doc-api, doc-processor, doc-websocket, admin-ui, dm-ui)
- Pushes images to GitHub Container Registry (GHCR)
- Tags images with:
  - `latest` (for main branch)
  - `main-abc123` (git SHA)
  - `v1.2.3` (semver tags)
  - `develop` (for develop branch)

### Automatic Triggers:
- ✅ Push to `main` or `develop` branches
- ✅ Pull request creation
- ✅ Git tags (e.g., `v1.0.0`)

### First Build:
```bash
# Commit and push the workflow file
git add .github/workflows/build-and-push.yml
git commit -m "Add GitHub Actions workflow for image builds"
git push origin main

# GitHub Actions will automatically build and push images
# Check progress: https://github.com/YOUR_USERNAME/NexusCodex/actions
```

---

## Step 2: Configure GitHub Container Registry Access

### Make Images Public (Recommended for Simplicity):

1. Go to: `https://github.com/YOUR_USERNAME?tab=packages`
2. Click each package (e.g., `nexuscodex-doc-api`)
3. Click **"Package settings"**
4. Scroll to **"Danger Zone"**
5. Click **"Change visibility"** → **"Public"**

**Public packages** = No authentication needed in Portainer!

### Or Use Private Images with Authentication:

If you prefer private images, you'll need to configure Portainer registry authentication:

1. In Portainer: **Registries** → **Add Registry**
   - **Name:** GitHub Container Registry
   - **Registry URL:** `ghcr.io`
   - **Authentication:** Enabled
   - **Username:** Your GitHub username
   - **Password:** GitHub Personal Access Token (PAT)

2. Create GitHub PAT:
   - Go to: `https://github.com/settings/tokens/new`
   - Select scopes: `read:packages`
   - Copy the token and use as password in Portainer

---

## Step 3: Deploy Stack in Portainer

### Method A: Using Portainer UI (Recommended)

1. **Navigate to Stacks:**
   - In Portainer: **Stacks** → **Add Stack**

2. **Configure Stack:**
   - **Name:** `nexuscodex`
   - **Build method:** **Git Repository**
   - **Repository URL:** `https://github.com/YOUR_USERNAME/NexusCodex`
   - **Repository reference:** `refs/heads/main`
   - **Compose path:** `docker-compose.prod.yml`

3. **Environment Variables:**
   ```env
   # GitHub Configuration
   GITHUB_REPO_OWNER=YOUR_GITHUB_USERNAME
   IMAGE_TAG=latest

   # Database
   POSTGRES_DB=doclib
   POSTGRES_USER=nexuscodex
   POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD

   # MinIO (S3)
   MINIO_ROOT_USER=minioadmin
   MINIO_ROOT_PASSWORD=CHANGE_ME_STRONG_PASSWORD

   # JWT Secret
   JWT_SECRET=CHANGE_ME_RANDOM_STRING_32_CHARS

   # API URLs (update with your domain)
   DOC_API_URL=http://your-domain.com:3005
   WEBSOCKET_URL=ws://your-domain.com:3002
   ```

4. **Deploy:**
   - Click **"Deploy the stack"**
   - Portainer will pull images from GHCR and deploy to swarm

### Method B: Using Portainer API

```bash
# Deploy via Portainer API
curl -X POST "https://your-portainer.com/api/stacks?type=1&method=repository&endpointId=1" \
  -H "X-API-Key: YOUR_PORTAINER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "nexuscodex",
    "repositoryURL": "https://github.com/YOUR_USERNAME/NexusCodex",
    "repositoryReferenceName": "refs/heads/main",
    "composeFile": "docker-compose.prod.yml",
    "env": [
      {"name": "GITHUB_REPO_OWNER", "value": "YOUR_USERNAME"},
      {"name": "IMAGE_TAG", "value": "latest"},
      {"name": "POSTGRES_PASSWORD", "value": "STRONG_PASSWORD"}
    ]
  }'
```

---

## Step 4: Verify Deployment

### Check Service Status:
1. In Portainer: **Swarm** → **Services**
2. Verify all services are running:
   - ✅ nexuscodex_doc-api (2 replicas)
   - ✅ nexuscodex_doc-processor (2 replicas)
   - ✅ nexuscodex_doc-websocket (1 replica)
   - ✅ nexuscodex_admin-ui (1 replica)
   - ✅ nexuscodex_dm-ui (1 replica)
   - ✅ nexuscodex_postgres
   - ✅ nexuscodex_redis
   - ✅ nexuscodex_elasticsearch
   - ✅ nexuscodex_minio

### Test Endpoints:
```bash
# Health checks
curl http://your-domain.com:3005/health      # doc-api
curl http://your-domain.com:3001             # admin-ui
curl http://your-domain.com:3003             # dm-ui

# MinIO console
open http://your-domain.com:9001
```

---

## Step 5: Setup Auto-Updates (Optional)

### Using Portainer Webhooks:

1. **Create Webhook:**
   - In Portainer: **Stacks** → **nexuscodex** → **Webhook**
   - Copy the webhook URL

2. **Add to GitHub Actions:**

Edit `.github/workflows/build-and-push.yml`, add at the end:

```yaml
  deploy-to-portainer:
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Trigger Portainer Deployment
        run: |
          curl -X POST "https://your-portainer.com/api/webhooks/YOUR_WEBHOOK_ID"
```

Now every push to `main` will:
1. Build images → Push to GHCR
2. Trigger Portainer to pull new images and redeploy

### Using Watchtower (Alternative):

Add a Watchtower service to auto-update on new images:

```yaml
  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 300 --cleanup
    deploy:
      placement:
        constraints:
          - node.role == manager
```

Watchtower will check GHCR every 5 minutes for new images and auto-update.

---

## Step 6: Database Initialization

On first deployment, initialize the database:

```bash
# Get into doc-api container
docker exec -it $(docker ps -q -f name=nexuscodex_doc-api) sh

# Run Prisma migrations
npx prisma migrate deploy

# Exit container
exit
```

Or use Portainer console:
1. **Containers** → **nexuscodex_doc-api**
2. Click **"Console"** → **"Connect"**
3. Run: `npx prisma migrate deploy`

---

## 🔄 Update Workflow

### Deploying Updates:

1. **Push code to GitHub:**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

2. **GitHub Actions automatically:**
   - Builds new images
   - Pushes to GHCR with `latest` tag
   - (Optional) Triggers Portainer webhook

3. **Update stack in Portainer:**
   - **Manual:** Stacks → nexuscodex → **"Update the stack"** → **"Pull latest image versions"**
   - **Webhook:** Automatic via GitHub Actions
   - **Watchtower:** Automatic every 5 minutes

### Rolling Back:

```bash
# Deploy specific version
# In Portainer, update stack environment:
IMAGE_TAG=main-abc123  # or v1.0.0

# Or from CLI:
docker service update --image ghcr.io/YOUR_USERNAME/nexuscodex-doc-api:v1.0.0 nexuscodex_doc-api
```

---

## 📊 Monitoring

### View Logs in Portainer:

1. **Services** → **nexuscodex_doc-api** → **Logs**
2. Or use CLI:
   ```bash
   docker service logs -f nexuscodex_doc-api
   ```

### Check Image Versions:

```bash
# See which image version is running
docker service inspect nexuscodex_doc-api --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
```

---

## 🔒 Production Hardening

### 1. Use Strong Secrets:

```bash
# Generate strong passwords
openssl rand -base64 32

# Update environment variables in Portainer
```

### 2. Enable HTTPS:

Add Traefik or nginx reverse proxy:

```yaml
  traefik:
    image: traefik:v2.10
    command:
      - --providers.docker=true
      - --providers.docker.swarmMode=true
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.letsencrypt.acme.email=your@email.com
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
      - --certificatesresolvers.letsencrypt.acme.tlschallenge=true
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik-certs:/letsencrypt
    deploy:
      placement:
        constraints:
          - node.role == manager
```

### 3. Limit Resources:

Already configured in `docker-compose.prod.yml`:
- ElasticSearch limited to 1GB RAM
- 2 replicas for API and processor (high availability)

### 4. Backup Volumes:

```bash
# Backup all data volumes
docker run --rm -v nexuscodex_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
docker run --rm -v nexuscodex_minio-data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup.tar.gz /data
```

---

## 🎯 Summary: Why GHCR + Portainer?

| Feature | GHCR + Actions | Portainer Builds |
|---------|----------------|------------------|
| **Build Speed** | ✅ Fast (pre-built) | ❌ Slow (builds on deploy) |
| **Production Safety** | ✅ Tested before deploy | ❌ Fails on prod |
| **Resource Usage** | ✅ Minimal (just pulls) | ❌ High (compiles on server) |
| **Rollback** | ✅ Easy (versioned tags) | ❌ Difficult |
| **CI/CD Integration** | ✅ Full pipeline | ❌ None |
| **Cost** | ✅ Free (GitHub runners) | ✅ Free |
| **Setup Complexity** | ⚠️ Medium | ✅ Simple |

---

**Recommended:** GitHub Actions → GHCR → Portainer for production deployments! 🚀
