# Deployment Quick Reference

Fast commands and checks for the current Dockhand + Docker Compose homelab
deployment.

## Current Model

- Dockhand manages the live stack.
- The stack runs on one Docker Engine server.
- The stack uses `docker/docker-compose.yml`.
- Images come from `ghcr.io/joelmale/nexusvtt`.
- GitHub Actions publishes images from `.github/workflows/ci.yml`.
- `master` is the CI branch.
- Dockhand redeploys the stack; GitHub Actions does not call Dockhand.
- Docker Swarm and Portainer are not part of the current deployment.

## Deploy Latest

1. Push or merge to `master`.
2. Wait for GitHub Actions: `CI Pipeline` -> `Build & Push to GHCR`.
3. In Dockhand, redeploy the Nexus VTT stack.
4. Keep `VERSION=latest`, or set a specific generated tag first.

## Required Dockhand Variables

```env
IMAGE_PREFIX=ghcr.io/joelmale/nexusvtt
VERSION=latest
PROXY_NETWORK=homelab-net

POSTGRES_DB=nexus
POSTGRES_USER=nexus
POSTGRES_PASSWORD=<secret>
DATABASE_URL=postgresql://nexus:<secret>@postgres:5432/nexus

REDIS_PASSWORD=<secret>
JWT_SECRET=<secret>
SESSION_SECRET=<secret>
ASSET_SERVICE_SECRET=<secret>

CORS_ORIGIN=https://app.nexusvtt.com
GOOGLE_CALLBACK_URL=https://app.nexusvtt.com/auth/google/callback
DISCORD_CALLBACK_URL=https://app.nexusvtt.com/auth/discord/callback
```

Optional OAuth provider values:

```env
GOOGLE_CLIENT_ID=<value>
GOOGLE_CLIENT_SECRET=<secret>
DISCORD_CLIENT_ID=<value>
DISCORD_CLIENT_SECRET=<secret>
```

## Health Checks

```bash
curl https://app.nexusvtt.com/health
curl https://app.nexusvtt.com/api/system/health
curl https://app.nexusvtt.com/api/metrics/multiplayer
```

Expected:

- `/health`: frontend nginx responds.
- `/api/system/health`: backend, database, and realtime coordinator are ready.
- `/api/metrics/multiplayer`: multiplayer SLO snapshot returns JSON.

## Docker Host Checks

```bash
docker ps --filter name=nexus
docker logs --tail 100 <backend-container>
docker logs --tail 100 <frontend-container>
docker logs --tail 100 <asset-service-container>
```

Find a container by service name:

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
```

## Database Backup

```bash
CONTAINER=$(docker ps -q -f name=postgres)
docker exec "$CONTAINER" pg_dump -U nexus nexus \
  | gzip > "nexus-$(date +%Y%m%d-%H%M%S).sql.gz"
```

## Apply Migrations

Run after a backup and before deploying backend code that requires the schema:

```bash
CONTAINER=$(docker ps -q -f name=postgres)

docker exec -i "$CONTAINER" psql -U nexus -d nexus \
  < server/migrations/2025-12-08-add-account-fields.sql
docker exec -i "$CONTAINER" psql -U nexus -d nexus \
  < server/migrations/2025-12-08-add-local-auth.sql
docker exec -i "$CONTAINER" psql -U nexus -d nexus \
  < server/migrations/2026-01-05-add-campaign-roomcode.sql
docker exec -i "$CONTAINER" psql -U nexus -d nexus \
  < server/migrations/2026-07-19-add-room-event-journal.sql
docker exec -i "$CONTAINER" psql -U nexus -d nexus \
  < server/migrations/2026-07-19-add-durable-game-state-commits.sql
docker exec -i "$CONTAINER" psql -U nexus -d nexus \
  < server/migrations/2026-07-19-add-room-entity-versions.sql
```

## Reverse Proxy

Public proxy target:

```text
https://app.nexusvtt.com -> frontend:80
```

The proxy must:

- Reach the Docker network named by `PROXY_NETWORK`
- Preserve `Host`
- Set `X-Forwarded-For`
- Set `X-Forwarded-Proto`
- Support WebSocket upgrades for `/ws`

The frontend container proxies backend routes internally.

## OAuth Redirects

Register these exact provider callbacks:

```text
https://app.nexusvtt.com/auth/google/callback
https://app.nexusvtt.com/auth/discord/callback
```

## Rollback

1. In Dockhand, set `VERSION` to the last known-good image tag.
2. Redeploy the stack.
3. If the Compose definition changed, restore the previous Dockhand stack
   definition.
4. If a migration must be reversed, restore PostgreSQL from backup.

## Full Guides

- Homelab: `docs/HOMELAB_DEPLOYMENT.md`
- Root production guide: `DEPLOYMENT.md`
- Reverse proxy notes: `docs/NPM_CONFIGURATION.md`
- NexusCodex homelab details: `docs/operations/nexuscodex-homelab.md`
- Google Cloud option: `docs/GCP_DEPLOYMENT_GUIDE.md`
