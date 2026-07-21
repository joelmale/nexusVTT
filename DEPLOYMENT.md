# Nexus VTT - Production Deployment Guide

## 🚨 QUICK FIX: OAuth "invalid_client" Error

**If you're seeing `TokenError: Unauthorized` with `code: 'invalid_client'` in production:**

Your OAuth callback URLs are set to `localhost` instead of your production domain.

### Fix in 2 Minutes:

1. **In Portainer:** Stacks → nexusvtt → Editor
2. **Find these lines** (around line 116-121 in the backend service):
   ```yaml
   # ❌ WRONG
   - GOOGLE_CALLBACK_URL=http://localhost:5001/auth/google/callback
   - DISCORD_CALLBACK_URL=http://localhost:5001/auth/discord/callback
   ```
3. **Change to:**
   ```yaml
   # ✅ CORRECT
   - GOOGLE_CALLBACK_URL=https://app.nexusvtt.com/auth/google/callback
   - DISCORD_CALLBACK_URL=https://app.nexusvtt.com/auth/discord/callback
   ```
4. **Click** "Update the stack"
5. **Wait** 30 seconds for backend to restart
6. **Test** - OAuth should work now!

### Also Update Google Cloud Console:

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Edit your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", add: `https://app.nexusvtt.com/auth/google/callback`
4. Remove any `localhost` entries
5. Save

---

## Quick Deployment Checklist

### 1. Configure Environment Variables in Portainer

Go to your `nexusvtt_backend` service and set these environment variables:

#### **Required Variables**

```bash
NODE_ENV=production
PORT=5000

# Database connection
# IMPORTANT: Service name is "postgres" (from docker-compose.yml), not "nexusvtt_postgres"
# Docker Swarm handles service discovery - use the service name from the compose file
DATABASE_URL=postgresql://nexus:YOUR_POSTGRES_PASSWORD@postgres:5432/nexus
POSTGRES_DB=nexus
POSTGRES_USER=nexus
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD_HERE

# Redis connection
# Service name is "redis" (from docker-compose.yml)
REDIS_PASSWORD=YOUR_SECURE_REDIS_PASSWORD

# Asset service write/reload secret
ASSET_SERVICE_SECRET=<run: openssl rand -base64 32>

# Optional: host path to the repo-owned TMT seed pack.
# Defaults to ../asset-packs/tmt relative to docker/docker-compose.yml.
TMT_ASSET_PACK_PATH=/path/to/nexusVTT/asset-packs/tmt

# OAuth Callback URLs (MUST be absolute URLs for OAuth providers)
GOOGLE_CALLBACK_URL=https://app.nexusvtt.com/auth/google/callback
DISCORD_CALLBACK_URL=https://app.nexusvtt.com/auth/discord/callback

# OAuth Credentials (use your actual values from OAuth consoles)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret

# Security (generate new secure random strings!)
SESSION_SECRET=<run: openssl rand -base64 32>
JWT_SECRET=<run: openssl rand -base64 32>
```

#### **Optional Variables** (only if needed)

```bash
# Only set if you need to override defaults
# CORS_ORIGIN=https://app.nexusvtt.com
```

> **Important:** `GOOGLE_CALLBACK_URL` and `DISCORD_CALLBACK_URL` **MUST** be set to absolute URLs (with https://) in production. OAuth providers require this for security.

---

### 2. Configure OAuth Providers

#### Google OAuth Console

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Add authorized redirect URI:
   ```
   https://app.nexusvtt.com/auth/google/callback
   ```
4. Save changes

#### Discord Developer Portal

1. Go to [Discord Developer Portal - Applications](https://discord.com/developers/applications)
2. Select your application (or create a new one)
3. Go to **OAuth2** section
4. Add redirect URI:
   ```
   https://app.nexusvtt.com/auth/discord/callback
   ```
5. Save changes
6. Copy your **Client ID** and **Client Secret** for the environment variables

---

### 3. Build and Push Docker Images

**Note:** Images are automatically built and pushed to GitHub Container Registry (GHCR) via GitHub Actions when you push to `master` branch. See `.github/workflows/build-and-push.yml` for details.

If you need to manually build and push:

```bash
# Navigate to project directory
cd /Users/JoelN/Coding/nexusVTT

# Build backend image
docker build -f docker/backend.Dockerfile -t ghcr.io/joelmale/nexusvtt/backend:latest .

# Build asset service image
docker build -f docker/asset-service.Dockerfile -t ghcr.io/joelmale/nexusvtt/asset-service:latest .

# Build frontend image
docker build -f docker/frontend.Dockerfile -t ghcr.io/joelmale/nexusvtt/frontend:latest .

# Push to GitHub Container Registry
docker push ghcr.io/joelmale/nexusvtt/backend:latest
docker push ghcr.io/joelmale/nexusvtt/asset-service:latest
docker push ghcr.io/joelmale/nexusvtt/frontend:latest
```

### TMT Asset Seed Pack

TMT assets are not baked into the main app image. The production `asset-service`
starts by validating the persistent `nexus-library-assets` volume. If the volume
is empty or incomplete, it seeds from a **host-local, gitignored** pack mounted at
`${TMT_ASSET_PACK_PATH:-../asset-packs/tmt}`.

The seed pack is not committed to the repo — bring your own copy (from an existing
`assets-data/` volume, a NAS share, an external drive, wherever you keep it) and
either drop it at the default path (`asset-packs/tmt/` at the repo root, already
gitignored) or set `TMT_ASSET_PACK_PATH` to point elsewhere. Preserve this shape:

```text
asset-packs/tmt/
  manifests/manifest-v2.json
  blobs/
  derivatives/
  browse/
  staging/
```

Before deploying on a new host, verify (or trigger) the seed:

```bash
npm run seed:library-assets
```

---

### 4. Apply Database Migrations

After deploying new images, run database migrations to update the schema. Since PostgreSQL runs in a container, you need to execute SQL files against the containerized database.

#### Option 1: Via Portainer Console

1. Go to Portainer → Containers → Find your PostgreSQL container (e.g., `nexus-prod_postgres`)
2. Click the container → **Console** tab
3. Click "Connect" (use `/bin/bash` or `/bin/sh`)
4. Run the migrations:
   ```bash
   # Inside the container
   psql -U nexus -d nexus << 'EOF'
   -- Paste the SQL migration content here
   -- Or run individual commands
   EOF
   ```

#### Option 2: Via Docker Command Line (from your server)

```bash
# SSH into your production server first
ssh your-server

# Find the PostgreSQL container name or ID
docker ps | grep postgres

# Option A: Copy migration files and execute
docker cp /path/to/server/migrations/2025-12-08-add-account-fields.sql CONTAINER_NAME:/tmp/
docker exec -it CONTAINER_NAME psql -U nexus -d nexus -f /tmp/2025-12-08-add-account-fields.sql

docker cp /path/to/server/migrations/2025-12-08-add-local-auth.sql CONTAINER_NAME:/tmp/
docker exec -it CONTAINER_NAME psql -U nexus -d nexus -f /tmp/2025-12-08-add-local-auth.sql

# Option B: Pipe SQL directly via stdin
docker exec -i CONTAINER_NAME psql -U nexus -d nexus < server/migrations/2025-12-08-add-account-fields.sql
docker exec -i CONTAINER_NAME psql -U nexus -d nexus < server/migrations/2025-12-08-add-local-auth.sql
docker exec -i CONTAINER_NAME psql -U nexus -d nexus < server/migrations/2026-01-05-add-campaign-roomcode.sql
docker exec -i CONTAINER_NAME psql -U nexus -d nexus < server/migrations/2026-07-19-add-room-event-journal.sql
docker exec -i CONTAINER_NAME psql -U nexus -d nexus < server/migrations/2026-07-19-add-durable-game-state-commits.sql
docker exec -i CONTAINER_NAME psql -U nexus -d nexus < server/migrations/2026-07-19-add-room-entity-versions.sql
```

#### What These Migrations Add:

- **2025-12-08-add-account-fields.sql**: Extended account fields (display name, bio, avatar URL, preferences, activity flags)
- **2025-12-08-add-local-auth.sql**: Local authentication password columns
- **2026-01-05-add-campaign-roomcode.sql**: Last-used room code and update timestamp for campaign recovery
- **2026-07-19-add-room-event-journal.sql**: Ordered, idempotent room event history
- **2026-07-19-add-durable-game-state-commits.sql**: Atomic canonical snapshot version and content-hash anchors
- **2026-07-19-add-room-entity-versions.sql**: Cross-replica token/prop version compare-and-swap anchors

> **Note:** These migrations are safe to run multiple times (use `IF NOT EXISTS` and conditional logic).
> Apply the 2026-01-05 migration followed by the three 2026-07-19 migrations in
> the listed order before updating any backend replica. Do
> not run mixed schema versions during a rolling update.

### Multiplayer Monitoring

The backend exports Prometheus metrics on `/metrics` and a JSON SLO snapshot on
`/api/metrics/multiplayer`. Keep `/metrics` on the internal network or set
`METRICS_AUTH_TOKEN`. The optional monitoring overlay starts Prometheus and
Grafana with the repository alert rules:

```bash
docker compose -f docker/docker-compose.yml \
  -f docker/docker-compose.observability.yml up -d
```

Set `GRAFANA_ADMIN_PASSWORD` before starting it. Use the `otel` profile and an
`OTEL_EXPORTER_OTLP_ENDPOINT` to forward the same metrics to an external
OpenTelemetry backend. Alert thresholds, response steps, and the required
post-deploy soak are in
`docs/operations/multiplayer-observability.md`.

---

### 5. Update Services in Portainer

1. Go to Portainer → Stacks → nexusvtt
2. For **both** `nexusvtt_backend` and `nexusvtt_frontend` services:
   - Click "Update the service"
   - Enable "Pull latest image"
   - Click "Update"
3. Wait for services to restart

---

### 5. Verify Deployment

After deployment, test these:

#### WebSocket Connection

1. Go to https://app.nexusvtt.com
2. Click "Start as Guest DM"
3. Enter a name
4. Click "Create Game"
5. Should connect successfully (no "Failed to create room" error)

#### Google OAuth

1. Go to https://app.nexusvtt.com
2. Click the Login button
3. Click "Google"
4. Should redirect to Google login
5. After login, should redirect back to https://app.nexusvtt.com/dashboard

#### Check Browser Console

Open DevTools (F12) and look for:

- ✅ `Connected to WebSocket in production mode`
- ✅ No errors about "localhost"
- ✅ No "connection refused" errors

---

## What Changed (Technical Details)

### Frontend Changes

- **WebSocket**: Uses `wss://app.nexusvtt.com/ws` in production (relative path)
- **Asset Manager**: Uses relative paths like `/manifest.json` in production
- **Document Service**: Uses relative paths like `/api/documents` in production

### Backend Changes

- **Trust Proxy**: Express now trusts nginx X-Forwarded-\* headers
- **Secure Cookies**: Work correctly behind HTTPS proxy
- **OAuth Redirects**: Use relative path `/dashboard` in production
- **Health Endpoints**: Return relative `/ws` path in production

### Infrastructure

- **nginx**: Proxies `/ws`, `/api`, `/auth` to `nexusvtt_backend:5000`
- **All services on same domain**: No CORS issues, no absolute URLs needed

---

## Troubleshooting

### WebSocket connection fails

- **Check**: Browser console shows what URL it's trying to connect to
- **Expected**: `wss://app.nexusvtt.com/ws`
- **Fix**: Make sure `NODE_ENV=production` is set in backend service

### OAuth redirects to localhost

- **Check**: Network tab in DevTools, look at the redirect URL
- **Expected**: Should redirect to `/dashboard` or `https://app.nexusvtt.com/dashboard`
- **Fix**: Make sure `NODE_ENV=production` is set in backend service

### "Connection Refused" or 502 errors

- **Check**: Make sure backend service is running and healthy
- **Check**: nginx can reach `nexusvtt_backend:5000`
- **Fix**: Check service logs in Portainer

### Session/cookies not working

- **Check**: Make sure `SESSION_SECRET` is set
- **Check**: Make sure cookies are being set (DevTools → Application → Cookies)
- **Fix**: Verify `trust proxy` is enabled (already in code)

### Google OAuth fails with "redirect_uri_mismatch"

- **Fix**: Add `https://app.nexusvtt.com/auth/google/callback` to Google OAuth Console
- **Check**: Make sure `GOOGLE_CALLBACK_URL` environment variable is set in Portainer

### Discord OAuth fails with "invalid oauth2 redirect_uri"

- **Fix**: Add `https://app.nexusvtt.com/auth/discord/callback` to Discord Developer Portal (OAuth2 section)
- **Check**: Make sure `DISCORD_CALLBACK_URL` environment variable is set in Portainer
- **Check**: URL must match exactly (including https://)

### OAuth redirects to dashboard but then back to lobby ("User not authenticated")

- **Symptom**: Console shows `GET /auth/me 401 (Unauthorized)`
- **Cause**: Session cookies not being forwarded by nginx proxy
- **Fix**: nginx config already includes cookie forwarding headers (in latest version)
- **Check**: Make sure you've deployed the latest frontend image with updated nginx.conf
- **Check**: In browser DevTools → Application → Cookies, verify `connect.sid` cookie is set for app.nexusvtt.com

### Guest DM creation fails with "Failed to create session"

- **Symptom**: WebSocket connects but server returns "Failed to create session" error
- **Symptom**: PostgreSQL logs show foreign key constraint violation on `campaigns.dmId`
- **Symptom**: Backend logs show "Anonymous as Guest" instead of "Guest as [Name]"
- **Root cause**: Browser not sending session cookies because fetch API calls missing `credentials: 'include'`
- **Fix**: Latest frontend code includes `credentials: 'include'` in all fetch calls (deploy latest frontend image)
- **Secondary requirement**: nginx.conf must include WebSocket cookie forwarding (deploy latest frontend image)
- **Alternative cause**: Database connection failing - check service name in DATABASE_URL
  ```
  DATABASE_URL=postgresql://nexus:YOUR_PASSWORD@postgres:5432/nexus
  ```
- **Check**: Backend service logs for specific database errors
- **Check**: PostgreSQL service logs for foreign key violations
- **Check**: PostgreSQL service is running and healthy
- **Check**: Browser DevTools → Network → POST /api/guest-users → Response Headers should show `Set-Cookie: connect.sid=...`
- **Check**: Browser DevTools → Network → WebSocket handshake → Request Headers should show `Cookie: connect.sid=...`

---

## Environment Variable Reference

See `.env.production.template` for full reference with comments.

### Minimal Production Config

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://nexus:password@nexusvtt_postgres:5432/nexus

# OAuth Callback URLs (REQUIRED - absolute URLs for OAuth providers)
GOOGLE_CALLBACK_URL=https://app.nexusvtt.com/auth/google/callback
DISCORD_CALLBACK_URL=https://app.nexusvtt.com/auth/discord/callback

# OAuth Credentials
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret

# Security
SESSION_SECRET=generate-32-char-random-string
JWT_SECRET=generate-32-char-random-string
```

**Note:** While most of the app uses relative URLs when behind nginx, OAuth providers (Google, Discord) **require absolute callback URLs** for security. Make sure these match exactly what you configured in the OAuth provider consoles.
