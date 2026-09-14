# Homelab Deployment Guide

This guide describes the current Nexus VTT homelab deployment. It intentionally
does not include Docker Swarm, Portainer, or Nginx Proxy Manager as required
parts of the system.

## Current Deployment Model

Nexus VTT runs as a Dockhand-managed Docker Compose stack on one Docker Engine
server.

- Runtime: single Docker Engine host
- Stack manager: Dockhand
- Compose file: `apps/vtt/docker/docker-compose.yml`
- Images: `ghcr.io/joelmale/nexusvtt/*`
- CI image publisher: `.github/workflows/ci.yml`
- Branch used by CI: `master`
- Public entrypoint: reverse proxy to the `frontend` container
- Shared proxy network: `homelab-net` by default
- Not used: Docker Swarm, Portainer, or `docker stack deploy`

Dockhand is the source of truth for live stack variables and redeploys. GitHub
Actions publishes images but does not automatically call Dockhand.

## Services

`apps/vtt/docker/docker-compose.yml` defines:

| Service | Image | Role |
| --- | --- | --- |
| `frontend` | `ghcr.io/joelmale/nexusvtt/frontend` | nginx + React app + internal API/WebSocket proxy |
| `backend` | `ghcr.io/joelmale/nexusvtt/backend` | Express API, auth, sessions, WebSocket server |
| `asset-service` | `ghcr.io/joelmale/nexusvtt/asset-service` | library and user asset serving/writes |
| `postgres` | `ghcr.io/joelmale/nexusvtt/postgres` | canonical durable database |
| `redis` | `redis:7-alpine` | ephemeral pub/sub, presence, and coordination |

Persistent data lives in named Docker volumes:

- `postgres-data`
- `redis-data`
- `nexus-assets`
- `nexus-user-assets`
- `nexus-library-assets`

## First-Time Dockhand Setup

1. Create or select the Dockhand stack for Nexus VTT.
2. Point the stack to `apps/vtt/docker/docker-compose.yml`.
3. Set the stack environment variables listed below.
4. Confirm the external proxy network exists on the Docker host.
5. Deploy the stack.
6. Point your reverse proxy at `frontend:80` on the external network.

Create the proxy network on the host if needed:

```bash
docker network create homelab-net
```

If your reverse proxy uses another network name, set:

```env
PROXY_NETWORK=<your proxy network>
```

## Required Environment

```env
IMAGE_PREFIX=ghcr.io/joelmale/nexusvtt
VERSION=latest
PROXY_NETWORK=homelab-net

POSTGRES_DB=nexus
POSTGRES_USER=nexus
POSTGRES_PASSWORD=<strong secret>
DATABASE_URL=postgresql://nexus:<same password>@postgres:5432/nexus

REDIS_PASSWORD=<strong secret>
JWT_SECRET=<strong secret>
SESSION_SECRET=<strong secret>
ASSET_SERVICE_SECRET=<strong secret>

CORS_ORIGIN=https://app.nexusvtt.com
GOOGLE_CALLBACK_URL=https://app.nexusvtt.com/auth/google/callback
DISCORD_CALLBACK_URL=https://app.nexusvtt.com/auth/discord/callback
```

OAuth provider credentials are optional only if provider login is intentionally
disabled:

```env
GOOGLE_CLIENT_ID=<google oauth client id>
GOOGLE_CLIENT_SECRET=<google oauth client secret>
DISCORD_CLIENT_ID=<discord app client id>
DISCORD_CLIENT_SECRET=<discord app client secret>
```

Keep secrets in Dockhand encrypted variables when possible.

## Image Publishing

The `CI Pipeline` workflow publishes images after linting, type checking, unit
tests, integration tests, asset-service tests, and production smoke tests pass.

Triggers:

- Push to `master`
- Push of a `v*` tag
- Manual `workflow_dispatch`

Images are pushed to GHCR with both a generated version tag and `latest`.
Dockhand must redeploy the stack to pull a new image.

## Deployment Procedure

1. Merge or push the intended change to `master`.
2. Wait for GitHub Actions to finish the `Build & Push to GHCR` job.
3. In Dockhand, confirm `IMAGE_PREFIX` and `VERSION`.
4. Redeploy or force recreate the stack in Dockhand.
5. Watch containers until `frontend`, `backend`, `asset-service`, `postgres`,
   and `redis` are running without restart loops.
6. Run the health checks below.

Use a specific `VERSION` tag when you want reproducibility. Use `latest` when
you want Dockhand to pull the newest successful image.

## Reverse Proxy

The public reverse proxy should send `https://app.nexusvtt.com` to
`frontend:80` on `PROXY_NETWORK`.

The frontend container's nginx config already handles:

- `/` and static SPA assets
- `/health`
- `/api`
- `/auth`
- `/ws`
- `/library`
- `/library-assets`

The public proxy should preserve forwarded headers and allow WebSocket upgrade
traffic. See `docs/NPM_CONFIGURATION.md` for a neutral reverse-proxy note.

## Database Migrations

Back up PostgreSQL before running migrations. Apply required migrations before
deploying backend images that depend on them:

```bash
CONTAINER=$(docker ps -q -f name=postgres)

docker exec -i "$CONTAINER" psql -U nexus -d nexus \
  < apps/vtt/server/migrations/2025-12-08-add-account-fields.sql
docker exec -i "$CONTAINER" psql -U nexus -d nexus \
  < apps/vtt/server/migrations/2025-12-08-add-local-auth.sql
docker exec -i "$CONTAINER" psql -U nexus -d nexus \
  < apps/vtt/server/migrations/2026-01-05-add-campaign-roomcode.sql
docker exec -i "$CONTAINER" psql -U nexus -d nexus \
  < apps/vtt/server/migrations/2026-07-19-add-room-event-journal.sql
docker exec -i "$CONTAINER" psql -U nexus -d nexus \
  < apps/vtt/server/migrations/2026-07-19-add-durable-game-state-commits.sql
docker exec -i "$CONTAINER" psql -U nexus -d nexus \
  < apps/vtt/server/migrations/2026-07-19-add-room-entity-versions.sql
```

The durable game-state migrations must be applied together and in order.

## TMT Asset Pack

Set `TMT_ASSET_PACK_PATH` if the TMT seed pack is not at the default relative
path:

```env
TMT_ASSET_PACK_PATH=/srv/nexus/asset-packs/tmt
```

Expected structure:

```text
asset-packs/tmt/
  manifests/manifest-v2.json
  blobs/
  derivatives/
  browse/
  staging/
```

The asset service seeds the persistent library volume only when it is missing
or incomplete.

## Validation

Run:

```bash
curl https://app.nexusvtt.com/health
curl https://app.nexusvtt.com/api/system/health
curl https://app.nexusvtt.com/api/metrics/multiplayer
```

Then perform a browser smoke:

1. Start a guest or authenticated session.
2. Create a room.
3. Join from a second browser profile or device.
4. Confirm dice rolls, scene state, and WebSocket sync work.

For NexusCodex-specific checks, use
`docs/operations/nexuscodex-homelab.md`.

## Troubleshooting

### New images did not appear after CI

- Confirm the GitHub Actions run reached `Build & Push to GHCR`.
- Confirm Dockhand redeployed after the images were published.
- Check whether the stack is pinned to a specific `VERSION`.

### Frontend works but API calls fail

- Confirm `backend` is running.
- Confirm `DATABASE_URL` points to `postgres:5432`.
- Confirm `REDIS_PASSWORD` matches the Redis command in Compose.
- Check `curl https://app.nexusvtt.com/api/system/health`.

### WebSocket sync fails

- Confirm the public reverse proxy allows upgrade requests.
- Check browser DevTools for the attempted `/ws` URL.
- Confirm the frontend container is the only public upstream; it proxies `/ws`
  to `backend:5001`.

### OAuth fails

- Confirm Dockhand values for `GOOGLE_CALLBACK_URL` and
  `DISCORD_CALLBACK_URL`.
- Confirm the same URLs are registered with Google and Discord.
- Confirm `SESSION_SECRET` is stable across redeploys.

## Cloud Option

The homelab is the production target. Cloud trials are separate documents. Keep
Google Cloud instructions in `docs/GCP_DEPLOYMENT_GUIDE.md`; AWS and Azure
guides can be added alongside it when those experiments begin.
