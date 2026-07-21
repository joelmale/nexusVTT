# Homelab Deployment Guide - Nginx Proxy Manager Edition

Complete guide for deploying Nexus VTT to your Proxmox Docker Swarm cluster with Nginx Proxy Manager and automatic GitHub deployments.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [DNS Configuration](#dns-configuration)
5. [Deploy to Docker Swarm](#deploy-to-docker-swarm)
6. [Configure Nginx Proxy Manager](#configure-nginx-proxy-manager)
7. [Setup GitHub Auto-Deploy](#setup-github-auto-deploy)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

**Already have everything set up? Here's the TL;DR:**

```bash
# 1. Clone repo on swarm manager
git clone https://github.com/yourusername/nexus.git /opt/nexus-vtt
cd /opt/nexus-vtt

# 2. Configure environment
cp .env.homelab.example .env.homelab
nano .env.homelab  # Fill in your values

# 3. Deploy stack
docker stack deploy -c docker/docker-compose.homelab.yml nexus

# 4. Configure NPM (see NPM_CONFIGURATION.md)
# - Add proxy host for app.nexusvtt.com → swarm-ip:3000
# - Add WebSocket support for /ws path
# - Enable SSL with Let's Encrypt

# 5. Setup GitHub auto-deploy
# - Add PORTAINER_WEBHOOK_URL to GitHub secrets
# - Push to main branch → auto-deploy
```

---

## Prerequisites

### Infrastructure

✅ **Docker Swarm cluster** (2 Proxmox nodes)

- Manager node with public IP or port forwarding
- Worker node(s) joined to swarm

✅ **Nginx Proxy Manager** installed and running

- Accessible at port 81 or custom port
- Has SSL certificate management configured
- Can reach your swarm services

✅ **Portainer** running on swarm (optional but recommended)

- Makes stack management much easier
- Provides webhook for auto-deployment

✅ **Domain**: `nexusvtt.com`

- DNS configured to point to your public IP
- Subdomains: `app.nexusvtt.com`, `assets.nexusvtt.com` (optional)

✅ **Network**

- Ports 80 and 443 forwarded to NPM host
- NPM can access swarm manager on ports 3000, 5000, 8081

### Software Requirements

- Docker Engine 24.0+
- Docker Swarm initialized
- Git
- OpenSSL (for generating secrets)

---

## Initial Setup

### 1. Initialize Docker Swarm (If Not Already Done)

On your **first Proxmox server** (will be the manager):

```bash
# Initialize swarm
docker swarm init --advertise-addr <manager-ip>

# Note the join token displayed - you'll need it for workers
```

On your **second Proxmox server** (worker):

```bash
# Join the swarm (use the token from above)
docker swarm join --token SWMTKN-1-... <manager-ip>:2377
```

Verify swarm is running:

```bash
# On manager
docker node ls
```

Should show both nodes.

### 2. Prepare Deployment Directory

SSH into your **swarm manager** node:

```bash
ssh user@swarm-manager-ip
```

Create the deployment directory:

```bash
sudo mkdir -p /opt/nexus-vtt
sudo chown $USER:$USER /opt/nexus-vtt
cd /opt/nexus-vtt
```

Clone the repository:

```bash
git clone https://github.com/yourusername/nexus.git .
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.homelab.example .env.homelab
```

Generate secure secrets:

```bash
# Generate all secrets at once
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "REDIS_PASSWORD=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "SESSION_SECRET=$(openssl rand -base64 32)"
```

Edit the environment file:

```bash
nano .env.homelab
```

**Minimal required configuration:**

```bash
# GitHub Container Registry
GITHUB_REPO=yourusername/nexus
VERSION=latest

# Domain
DOMAIN=nexusvtt.com
ACME_EMAIL=your-email@example.com

# Database (paste generated password)
POSTGRES_DB=nexus
POSTGRES_USER=nexus
POSTGRES_PASSWORD=<paste-generated-password>

# Redis (paste generated password)
REDIS_PASSWORD=<paste-generated-password>

# Application Secrets (paste generated secrets)
JWT_SECRET=<paste-generated-secret>
SESSION_SECRET=<paste-generated-secret>

# CORS (required for frontend-backend communication)
CORS_ORIGIN=https://app.nexusvtt.com,https://nexusvtt.com
```

**Optional OAuth configuration** (for Google/Discord login):

```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

Save and close (`Ctrl+X`, `Y`, `Enter`).

**IMPORTANT:** Save these passwords somewhere secure (password manager). You'll need them for database access and troubleshooting.

---

## DNS Configuration

Configure DNS records at your domain registrar (where you bought `nexusvtt.com`):

### Required Records

Point these to your **public IP address**:

| Type | Name | Value            | TTL |
| ---- | ---- | ---------------- | --- |
| A    | @    | `your.public.ip` | 300 |
| A    | app  | `your.public.ip` | 300 |

### Optional Records

| Type | Name   | Value            | TTL |
| ---- | ------ | ---------------- | --- |
| A    | assets | `your.public.ip` | 300 |
| A    | www    | `your.public.ip` | 300 |

### Using Dynamic DNS

If you have a dynamic public IP, consider using a DDNS service:

1. Set up DDNS with a provider (DuckDNS, No-IP, Cloudflare, etc.)
2. Create CNAME records pointing to your DDNS hostname:

| Type  | Name | Value                       | TTL |
| ----- | ---- | --------------------------- | --- |
| CNAME | app  | `your-hostname.duckdns.org` | 300 |

### Verify DNS Propagation

```bash
# From your local machine
dig app.nexusvtt.com
nslookup app.nexusvtt.com

# Should return your public IP
```

DNS can take 5-10 minutes to propagate. Use https://dnschecker.org to verify globally.

---

## Apply Database Migrations

Before updating backend replicas on an existing installation, back up
PostgreSQL and apply these migrations in order:

```bash
docker exec -i $(docker ps -q -f name=nexus_postgres) \
  psql -U nexus -d nexus < server/migrations/2026-01-05-add-campaign-roomcode.sql
docker exec -i $(docker ps -q -f name=nexus_postgres) \
  psql -U nexus -d nexus < server/migrations/2026-07-19-add-room-event-journal.sql
docker exec -i $(docker ps -q -f name=nexus_postgres) \
  psql -U nexus -d nexus < server/migrations/2026-07-19-add-durable-game-state-commits.sql
docker exec -i $(docker ps -q -f name=nexus_postgres) \
  psql -U nexus -d nexus < server/migrations/2026-07-19-add-room-entity-versions.sql
```

The January migration preserves the last room code used by each campaign. The
second July migration adds the snapshot `stateVersion` and `syncToken` anchors
required by every backend replica. The third July migration makes
entity-version conflicts atomic across replicas. Deploy the schema before the
application; do not run the new backend against an unmigrated database.

## Deploy to Docker Swarm

### Option A: Deploy via Portainer (Recommended)

1. **Access Portainer:**
   - Navigate to `https://portainer.yourdomain.com` or `http://swarm-ip:9000`

2. **Create Stack:**
   - Go to **Stacks** → **Add Stack**
   - **Name:** `nexus`

3. **Choose Build Method:**
   - **Repository:** Select "Git Repository"
   - **Repository URL:** `https://github.com/yourusername/nexus`
   - **Repository reference:** `refs/heads/main`
   - **Compose path:** `docker/docker-compose.homelab.yml`

   OR

   - **Upload:** Upload the `docker-compose.homelab.yml` file

4. **Environment Variables:**
   - Click **Load variables from .env file**
   - Paste contents of `.env.homelab`

   OR manually add each variable:

   ```
   GITHUB_REPO=yourusername/nexus
   VERSION=latest
   POSTGRES_PASSWORD=...
   REDIS_PASSWORD=...
   JWT_SECRET=...
   SESSION_SECRET=...
   CORS_ORIGIN=https://app.nexusvtt.com,https://nexusvtt.com
   ```

5. **Deploy:**
   - Click **Deploy the stack**
   - Wait for services to start (30-60 seconds)

6. **Verify Deployment:**
   - Go to **Stacks** → **nexus**
   - All services should show as "Running" (green)

### Option B: Deploy via Command Line

On your swarm manager:

```bash
cd /opt/nexus-vtt

# Load environment variables
export $(cat .env.homelab | xargs)

# Deploy stack
docker stack deploy -c docker/docker-compose.homelab.yml nexus
```

### Verify Deployment

Check stack status:

```bash
# List all services
docker stack services nexus

# Should show:
# nexus_backend      3/3 replicas
# nexus_frontend     2/2 replicas
# nexus_postgres     1/1 replicas
# nexus_redis        1/1 replicas
```

Check service logs:

```bash
# Backend logs
docker service logs nexus_backend -f

# Frontend logs
docker service logs nexus_frontend -f

# Press Ctrl+C to stop following logs
```

Test services locally (from swarm manager):

```bash
# Test frontend
curl http://localhost:3000

# Test backend health
curl http://localhost:5000/health
# Should return: {"status":"ok"}
```

---

## Configure Nginx Proxy Manager

See **[NPM_CONFIGURATION.md](./NPM_CONFIGURATION.md)** for detailed NPM setup.

### Quick NPM Setup

1. **Access NPM:**
   - Navigate to your NPM admin interface (usually port 81)
   - Login with your credentials

2. **Add Proxy Host for Frontend + Backend:**
   - Go to **Hosts** → **Proxy Hosts** → **Add Proxy Host**

   **Details Tab:**
   - Domain Names: `app.nexusvtt.com`
   - Scheme: `http`
   - Forward Hostname/IP: `<swarm-manager-ip>` (e.g., `192.168.1.100`)
   - Forward Port: `3000`
   - Cache Assets: ✅
   - Block Common Exploits: ✅
   - Websockets Support: ❌ (handled in Advanced tab)

   **SSL Tab:**
   - SSL Certificate: "Request a new SSL Certificate"
   - Force SSL: ✅
   - HTTP/2 Support: ✅
   - HSTS Enabled: ✅
   - Email: your-email@example.com
   - I Agree: ✅

   **Advanced Tab:**

   ```nginx
   # Frontend - React SPA
   location / {
       proxy_pass http://SWARM_IP:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }

   # Backend API
   location ~ ^/(api|auth|health) {
       proxy_pass http://SWARM_IP:5000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }

   # WebSocket (CRITICAL for real-time features!)
   location /ws {
       proxy_pass http://SWARM_IP:5000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_connect_timeout 7d;
       proxy_send_timeout 7d;
       proxy_read_timeout 7d;
   }
   ```

   **Replace `SWARM_IP` with your actual IP** (e.g., `192.168.1.100`)

3. **Save** the proxy host

4. **Test Access:**
   - Open browser: `https://app.nexusvtt.com`
   - Should show Nexus VTT login page
   - Check SSL padlock icon (should be green/secure)

---

## Setup GitHub Auto-Deploy

### 1. Enable GitHub Container Registry

Your GitHub repository needs to publish Docker images to GHCR.

**Make repository public** (for free GHCR) OR configure package permissions:

1. Go to `https://github.com/yourusername/nexus/settings`
2. Scroll to **Danger Zone** → Change visibility to **Public** (if comfortable)

   OR

3. After first workflow run, go to package settings and make images public:
   - `https://github.com/users/yourusername/packages/container/nexus%2Ffrontend/settings`
   - Change visibility to **Public**

### 2. Create Portainer Webhook

In Portainer:

1. Go to **Stacks** → **nexus**
2. Scroll to **Webhooks** section
3. Click **Add webhook**
4. **Name:** `github-deploy`
5. **Copy the webhook URL** (looks like `https://portainer.../api/webhooks/xxx...`)

### 3. Add GitHub Secrets

Go to your GitHub repository settings:

```
https://github.com/yourusername/nexus/settings/secrets/actions
```

Click **New repository secret** and add:

| Secret Name             | Value                                      | Example                         |
| ----------------------- | ------------------------------------------ | ------------------------------- |
| `PORTAINER_WEBHOOK_URL` | `https://portainer.../api/webhooks/xxx...` | Full webhook URL from Portainer |

### 4. Enable Workflow Permissions

1. Go to **Settings** → **Actions** → **General**
2. Scroll to **Workflow permissions**
3. Select: **Read and write permissions**
4. Check: **Allow GitHub Actions to create and approve pull requests**
5. Click **Save**

### 5. Test Auto-Deploy

Make a small change and push to `main`:

```bash
# On your local machine
cd /path/to/nexus
git checkout main

# Make a small change
echo "# Deployed via GitHub Actions" >> README.md

git add README.md
git commit -m "Test auto-deploy"
git push origin main
```

**Watch the magic happen:**

1. Go to **Actions** tab in GitHub: `https://github.com/yourusername/nexus/actions`
2. You should see a new workflow run: "Deploy to Homelab"
3. Click on it to watch progress:
   - ✅ Build frontend image
   - ✅ Build backend image
   - ✅ Push to GHCR
   - ✅ Trigger Portainer webhook
   - ✅ Health check

4. In Portainer:
   - Go to **Stacks** → **nexus**
   - Services should show "Updating" then "Running"

5. Verify deployment:
   ```bash
   curl https://app.nexusvtt.com/health
   curl https://app.nexusvtt.com/api/system/health
   ```

**Deployment complete!** 🎉

---

## Monitoring & Maintenance

### View Logs

**Via Portainer:**

1. **Stacks** → **nexus** → Click service → **Logs** tab

**Via CLI:**

```bash
# Backend logs (real-time)
docker service logs -f nexus_backend

# Frontend logs
docker service logs -f nexus_frontend

# Last 100 lines
docker service logs --tail 100 nexus_backend

# Specific container
docker logs <container-id> -f
```

### Scale Services

**Via Portainer:**

1. **Stacks** → **nexus** → Click service
2. Click **Scale** button
3. Adjust replicas

**Via CLI:**

```bash
# Scale backend to 5 instances
docker service scale nexus_backend=5

# Scale frontend to 3 instances
docker service scale nexus_frontend=3

# Scale down during low traffic
docker service scale nexus_backend=2
```

### Update Services Manually

**Via Portainer:**

1. **Stacks** → **nexus**
2. Click **Pull and redeploy**

**Via CLI:**

```bash
# Update to latest images
docker service update --image ghcr.io/yourusername/nexus/frontend:latest nexus_frontend
docker service update --image ghcr.io/yourusername/nexus/backend:latest nexus_backend

# Force update (even if image hasn't changed)
docker service update --force nexus_backend
```

### Database Backups

Create a backup script:

```bash
# Create backup directory
mkdir -p /opt/nexus-vtt/backups

# Create backup script
nano /opt/nexus-vtt/scripts/backup-db.sh
```

Paste this content:

```bash
#!/bin/bash
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/nexus-vtt/backups
mkdir -p $BACKUP_DIR

# Find postgres container
CONTAINER=$(docker ps -q -f name=nexus_postgres)

if [ -z "$CONTAINER" ]; then
    echo "Error: Postgres container not found"
    exit 1
fi

# Backup
echo "Starting backup: nexus_$TIMESTAMP.sql.gz"
docker exec $CONTAINER pg_dump -U nexus nexus | gzip > $BACKUP_DIR/nexus_$TIMESTAMP.sql.gz

# Keep last 30 days
find $BACKUP_DIR -name "nexus_*.sql.gz" -mtime +30 -delete

echo "✅ Backup completed: $BACKUP_DIR/nexus_$TIMESTAMP.sql.gz"
```

Make executable:

```bash
chmod +x /opt/nexus-vtt/scripts/backup-db.sh
```

Run manually:

```bash
/opt/nexus-vtt/scripts/backup-db.sh
```

**Automate with cron:**

```bash
crontab -e

# Add this line (daily at 2 AM):
0 2 * * * /opt/nexus-vtt/scripts/backup-db.sh >> /var/log/nexus-backup.log 2>&1
```

### Restore Database

```bash
# List backups
ls -lh /opt/nexus-vtt/backups/

# Find container ID
CONTAINER=$(docker ps -q -f name=nexus_postgres)

# Copy backup into container
docker cp /opt/nexus-vtt/backups/nexus_20250103_020000.sql.gz $CONTAINER:/tmp/backup.sql.gz

# Restore
docker exec -it $CONTAINER bash -c "
  gunzip /tmp/backup.sql.gz
  psql -U nexus nexus < /tmp/backup.sql
  rm /tmp/backup.sql
"

echo "✅ Database restored"
```

---

## Troubleshooting

### Issue: Services Won't Start

**Check service status:**

```bash
docker service ps nexus_backend --no-trunc
```

**View logs:**

```bash
docker service logs nexus_backend
docker service logs nexus_postgres
```

**Common causes:**

- ❌ Missing environment variables → Check `.env.homelab`
- ❌ Database not ready → Wait 30 seconds, check postgres logs
- ❌ Image pull failed → Check GitHub package permissions
- ❌ Port conflict → Check if ports 3000/5000 are already in use

### Issue: Can't Access app.nexusvtt.com

**1. Check DNS:**

```bash
nslookup app.nexusvtt.com
# Should return your public IP
```

**2. Check port forwarding:**

- Router should forward 80 and 443 to NPM host

**3. Check NPM proxy host:**

- Verify domain name is `app.nexusvtt.com` (no typos)
- Verify forward IP is correct swarm manager IP
- Check NPM logs for errors

**4. Check SSL certificate:**

- NPM → SSL Certificates → Should show "app.nexusvtt.com" with green status

### Issue: Frontend Loads but Shows "API Connection Error"

**Check backend health:**

```bash
curl https://app.nexusvtt.com/api/system/health
```

The public `/health` endpoint checks the frontend nginx container. The
`/api/system/health` endpoint checks the backend database and realtime
coordinator. `/api/health` belongs to the optional document integration and is
not a backend readiness probe.

If fails:

**1. Verify NPM routing:**

- Check Advanced tab has `/api` location block
- Verify swarm IP is correct in proxy_pass

**2. Check backend logs:**

```bash
docker service logs nexus_backend | tail -50
```

**3. Verify CORS configuration:**

```bash
# Check backend environment
docker service inspect nexus_backend --format='{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep CORS

# Should include: CORS_ORIGIN=https://app.nexusvtt.com
```

**4. Update CORS if needed:**

```bash
docker service update \
  --env-add CORS_ORIGIN=https://app.nexusvtt.com,https://nexusvtt.com \
  nexus_backend
```

### Issue: WebSocket Connection Failed

**Symptoms:** Real-time features don't work (can't see other players' cursors, chat doesn't update)

**Check browser console:**

- Press F12 → Console tab
- Look for WebSocket errors

**Verify NPM configuration:**

1. NPM → Edit `app.nexusvtt.com` proxy host
2. Advanced tab should have `/ws` location block with:
   ```nginx
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   ```

**Test WebSocket:**

```bash
# Install wscat: npm install -g wscat
wscat -c wss://app.nexusvtt.com/ws

# Should connect (may timeout without authentication, but connection should succeed)
```

### Issue: GitHub Actions Fails to Push Images

**Check workflow permissions:**

1. GitHub repo → Settings → Actions → General
2. Workflow permissions: **Read and write permissions**

**Check package visibility:**

After first run, images are private by default. Make them public:

1. Go to `https://github.com/users/yourusername/packages`
2. Click `nexus/frontend`
3. **Package settings** → **Change visibility** → **Public**
4. Repeat for `nexus/backend`

### Issue: Portainer Webhook Not Triggered

**Test webhook manually:**

```bash
curl -X POST "YOUR_PORTAINER_WEBHOOK_URL"
```

Should trigger a redeploy in Portainer.

**Check GitHub secret:**

1. GitHub repo → Settings → Secrets → Actions
2. Verify `PORTAINER_WEBHOOK_URL` is correct
3. Should be the full URL from Portainer including `/api/webhooks/...`

**Check GitHub Actions logs:**

1. Actions tab → Latest workflow
2. Click "Trigger Portainer Deployment" step
3. Look for curl error messages

### Complete Reset

If everything is broken and you need to start fresh:

```bash
# Stop and remove stack
docker stack rm nexus

# Wait for services to stop
sleep 30

# Remove volumes (⚠️ WARNING: DESTROYS ALL DATA!)
docker volume rm nexus_postgres-data
docker volume rm nexus_redis-data

# Redeploy
cd /opt/nexus-vtt
docker stack deploy -c docker/docker-compose.homelab.yml nexus

# Reconfigure NPM proxy host
```

---

## Performance Tuning

### For Resource-Constrained Homelab

Edit `docker-compose.homelab.yml`:

```yaml
frontend:
  deploy:
    replicas: 1 # Reduce from 2

backend:
  deploy:
    replicas: 2 # Reduce from 3
```

### Add Resource Limits

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 512M
```

Redeploy:

```bash
docker stack deploy -c docker/docker-compose.homelab.yml nexus
```

---

## Security Checklist

- [ ] Changed all default passwords in `.env.homelab`
- [ ] Using strong passwords (32+ characters)
- [ ] SSL certificates enabled in NPM
- [ ] Database backups configured (cron job)
- [ ] Firewall enabled on swarm nodes
- [ ] Portainer access limited to trusted IPs (optional)
- [ ] NPM admin panel not publicly accessible
- [ ] GitHub secrets configured correctly
- [ ] Docker images scanning enabled (optional: Trivy/Snyk)

---

## Next Steps

- ✅ **Configure OAuth:** Add Google/Discord login
- ✅ **Set up monitoring:** Prometheus + Grafana for metrics
- ✅ **Enable backups:** Automated database backups to external storage
- ✅ **Add staging environment:** Test changes before production
- ✅ **Custom domain for assets:** `assets.nexusvtt.com` for static files

---

## Support

- **GitHub Issues:** https://github.com/yourusername/nexus/issues
- **NPM Configuration:** See [NPM_CONFIGURATION.md](./NPM_CONFIGURATION.md)
- **Docker Swarm Docs:** https://docs.docker.com/engine/swarm/
- **Portainer Docs:** https://docs.portainer.io/

---

**Congratulations!** Your Nexus VTT is now deployed on your homelab with automatic GitHub deployments! 🎉
