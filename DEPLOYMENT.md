# Nexus VTT Production Deployment

This is the canonical production deployment guide for the current homelab
setup.

## Current Deployment Model

Nexus VTT currently runs as a Dockhand-managed Docker Compose stack on a single
Docker Engine server.

- Orchestrator: Dockhand
- Runtime substrate: one Docker Engine host
- Compose file: `apps/vtt/docker/docker-compose.yml`
- Image registry: GitHub Container Registry at `ghcr.io/joelmale/nexusvtt`
- CI publisher: `.github/workflows/ci.yml` on `master`, tags, and manual runs
- Reverse proxy: an external container network, usually `homelab-net`
- Not used: Docker Swarm, Portainer, Kubernetes, or Nginx Proxy Manager as a
  required deployment component

The repository builds and publishes images. Dockhand owns the live stack,
environment variables, secrets, and redeploy action.

## Runtime Topology

```text
browser
  -> public HTTPS reverse proxy
  -> frontend container on the external proxy network
  -> backend:5001 on the private Compose network
  -> postgres, redis, asset-service
```

The frontend image includes nginx. It serves the React app and proxies `/api`,
`/auth`, `/ws`, `/library`, and `/library-assets` to the backend over the
private Compose network.

## Images

The CI pipeline builds and pushes these images:

- `ghcr.io/joelmale/nexusvtt/frontend:<version>`
- `ghcr.io/joelmale/nexusvtt/backend:<version>`
- `ghcr.io/joelmale/nexusvtt/asset-service:<version>`
- `ghcr.io/joelmale/nexusvtt/postgres:<version>`

Every successful push build also publishes `:latest`. Non-tag pushes use a
date-and-short-SHA tag such as `20260911-abcdef1`; version tags strip the
leading `v`.

## Dockhand Stack Configuration

Use `apps/vtt/docker/docker-compose.yml` as the stack definition in Dockhand. Set the
stack name to the live name you use operationally, such as `nexus-vtt2`.

Dockhand must provide the Compose environment. Required production values:

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

Optional provider credentials:

```env
GOOGLE_CLIENT_ID=<google oauth client id>
GOOGLE_CLIENT_SECRET=<google oauth client secret>
DISCORD_CLIENT_ID=<discord app client id>
DISCORD_CLIENT_SECRET=<discord app client secret>
```

Keep secrets in Dockhand encrypted variables when possible. Do not commit live
provider credentials, passwords, or session secrets.

## Reverse Proxy

The Compose file attaches only `frontend` to the external proxy network:

```env
PROXY_NETWORK=homelab-net
```

Your reverse proxy should route the public app hostname to the frontend
container on port `80`. The frontend nginx container handles the internal API
and WebSocket proxying, so the public reverse proxy does not need separate
routes to `backend`.

Required reverse-proxy behavior:

- Terminate TLS for `https://app.nexusvtt.com`
- Forward HTTP traffic to `frontend:80`
- Preserve `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto`
- Allow WebSocket upgrade traffic for `/ws`

See `docs/NPM_CONFIGURATION.md` for a reverse-proxy-agnostic routing note. The
filename is historical; Nginx Proxy Manager is not required.

## Deploy or Update

1. Push to `master` or run the CI workflow manually.
2. Wait for the `Build & Push to GHCR` job in `.github/workflows/ci.yml`.
3. In Dockhand, redeploy the Nexus VTT stack with the desired `VERSION`.
4. Use `VERSION=latest` for the rolling current image or a specific generated
   tag for a pinned deployment.

Dockhand is the deployment trigger. The GitHub workflow does not call Dockhand
or any Portainer webhook.

## Database Migrations

Back up PostgreSQL before schema changes. Apply migrations before deploying a
backend image that depends on them.

From the Docker host, with the repository available:

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

The 2026-07-19 migrations are part of the durable game-state contract. Do not
run a backend that emits canonical game-state acknowledgements against an
unmigrated database.

## Asset Seed Pack

The TMT library is not baked into the application images. The asset service
validates the persistent `nexus-library-assets` volume at startup and seeds it
from a host-local pack if needed:

```env
TMT_ASSET_PACK_PATH=/path/to/asset-packs/tmt
```

The default is `../asset-packs/tmt` relative to `apps/vtt/docker/docker-compose.yml`.
The pack should contain:

```text
asset-packs/tmt/
  manifests/manifest-v2.json
  blobs/
  derivatives/
  browse/
  staging/
```

## Health Checks

After Dockhand redeploys, verify:

```bash
curl https://app.nexusvtt.com/health
curl https://app.nexusvtt.com/api/system/health
curl https://app.nexusvtt.com/api/metrics/multiplayer
```

`/health` is the frontend nginx probe. `/api/system/health` checks the backend,
database, and realtime coordinator. `/api/metrics/multiplayer` is the quickest
post-deploy multiplayer SLO snapshot.

Manual smoke:

1. Open `https://app.nexusvtt.com`.
2. Start as a guest DM.
3. Create a room.
4. Join from a second browser profile or device.
5. Confirm WebSocket sync, dice, and scene state update both clients.

## OAuth Checks

OAuth callback URLs must be absolute HTTPS URLs and must match provider console
settings exactly:

```text
https://app.nexusvtt.com/auth/google/callback
https://app.nexusvtt.com/auth/discord/callback
```

If OAuth reports `invalid_client` or `redirect_uri_mismatch`, check Dockhand
variables first, then the Google Cloud Console or Discord Developer Portal.

## Rollback

Use one of these rollback paths:

- Set `VERSION` in Dockhand to the previous known-good CI tag and redeploy.
- Restore the prior Compose definition from Dockhand history if the Compose
  definition changed.
- Restore PostgreSQL from backup if a data migration must be reversed.

The rollback Compose snapshot for the pre-NexusCodex stack is preserved at
`docker/rollback/nexus-vtt2-compose-before-nexuscodex-20260721.yaml`.

## Cloud Experiments

Homelab production is Dockhand on Docker Compose. Cloud experiments are tracked
separately so they do not contaminate the live runbook:

- Google Cloud: `docs/GCP_DEPLOYMENT_GUIDE.md`
- AWS: planned
- Azure: planned
