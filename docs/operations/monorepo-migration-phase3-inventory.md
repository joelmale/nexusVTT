# Phase 3 deployment inventory

This is an evidence inventory, not an architecture, release, history, schema,
or data-safety decision. It was collected 2026-09-12 from Dockhand environment
1 (`HomePod`, Docker socket, host `192.168.100.20`) and repository files on
branch `codex/monorepo-migration`. Secret values are intentionally omitted.

## Evidence and scope

- Live stack: Dockhand stack `nexus-vtt2`; Compose path reported as
  `/opt/dockhand/stacks/HomePod/nexus-vtt2/compose.yaml`; environment file is
  `/opt/dockhand/stacks/HomePod/nexus-vtt2/.env`.
- Repository definitions compared: `deploy/homelab/compose.yaml` (production
  draft), `deploy/homelab/compose.rehearsal.yaml` (override), and
  `deploy/homelab/.env.example`.
- Application build evidence: `apps/vtt/docker/*.Dockerfile`,
  `apps/forge/Dockerfile`, and the five Codex service Dockerfiles.
- The live stack has 15 running containers. All 15 are members of the external
  bridge network `homelab-net` (`172.18.0.0/16`, gateway `172.18.0.1`, not
  internal). No live `nexus-vtt2` container has a published host port.

## Service and identity inventory

| service | live image; candidate image in production draft | live container / hostname | live ports and networks | live restart |
|---|---|---|---|---|
| postgres | `ghcr.io/joelmale/nexusvtt/postgres:latest`; `ghcr.io/joelmale/nexusvtt/postgres@sha256:08b7399e0881d8650ddd67c0adbab8b0a4c166a5b8d49e62e13f94ab342f9385` | `nexus-vtt2-postgres-1` / Docker-generated `8a2420f0c945` | 5432/tcp internal; `homelab-net` | `no` |
| redis | `redis:7-alpine`; pinned live digest `sha256:ff02b58f...eadf` | `nexus-vtt2-redis-1` / `8a10af07e86b` | 6379/tcp internal; `homelab-net` | `no` |
| asset-server | `ghcr.io/joelmale/nexusvtt/asset-service:latest`; `.../asset-service@sha256:ae34ae1bb7be46dd70051899eee9e4d6af265e30c7ce9905ef4556bc4b96e71d` | `nexus-vtt2-asset-server` / `nexus-vtt2-asset-server` | 5003/tcp internal; `homelab-net` | `unless-stopped` |
| nexus-forge | `ghcr.io/joelmale/nexus-forge:latest`; `.../nexus-forge@sha256:d1d5019db84a0f21fd10de436da17c9ac6df52223cdfb3e69455349cccf348f0` | `nexus-vtt2-forge` / `nexus-vtt2-forge` | 8080/tcp internal; `homelab-net` | `no` |
| frontend | `ghcr.io/joelmale/nexusvtt/frontend:latest`; `.../frontend@sha256:d6938c26e23111a3625c91d9730b0be33b54eabcf9526680fef9390aaeaa70cb` | `nexus-vtt2-frontend` / `nexus-vtt2-frontend` | 80/tcp internal; `homelab-net` | `no` |
| backend | `ghcr.io/joelmale/nexusvtt/backend:latest`; `.../backend@sha256:70a1786cffb560ed11abde34dd98fbd739455abcf34058d3722a21b1f2ef1016` | `nexus-vtt2-backend-1` / Docker-generated `a125b0740d11` | 5001/tcp internal; `homelab-net` | `no` |
| codex-postgres | `postgres:16-alpine`; pinned live digest `sha256:cf78e766...0685` | `nexus-vtt2-codex-postgres-1` / `9f98d9bddba4` | 5432/tcp internal; `homelab-net` | `on-failure` (max 3) |
| codex-redis | `redis:7-alpine`; pinned live digest `sha256:ff02b58f...eadf` | `nexus-vtt2-codex-redis-1` / `04352126622c` | 6379/tcp internal; `homelab-net` | `on-failure` |
| codex-elasticsearch | `elasticsearch:8.11.0`; pinned live digest `sha256:2cadca6c...3fad` | `nexus-vtt2-codex-elasticsearch-1` / `c9d52978d76c` | 9200/9300 tcp internal; `homelab-net` | `on-failure` |
| codex-minio | live `minio/minio:latest`; pinned live release/digest `RELEASE.2025-09-07T16-13-09Z@sha256:14cea493...936e` | `nexus-vtt2-codex-minio-1` / `ea74bd8e3ba5` | 9000/tcp internal (9001 command console); `homelab-net` | `on-failure` |
| doc-api | `ghcr.io/joelmale/nexuscodex-doc-api:latest`; `.../doc-api@sha256:418f55be5f67fedec5aff08606ebfe1ec1b112831ec57da8f7ce610c79e17a9c` | `nexus-vtt2-doc-api-1` / `0c8711a757ff` | 3000/tcp internal; `homelab-net` | `on-failure` (max 3) |
| doc-processor | `ghcr.io/joelmale/nexuscodex-doc-processor:latest`; `.../doc-processor@sha256:47c3d72cf5f70326fce9a154625a5c6466256b5214d5030d5a7a912302b6739d` | `nexus-vtt2-doc-processor-1` / `df0d49ca4b1f` | no declared port; `homelab-net` | `on-failure` (max 3) |
| doc-websocket | `ghcr.io/joelmale/nexuscodex-doc-websocket:latest`; `.../doc-websocket@sha256:da014e1fdc704b1f8b1821432787e7100aa8eb7640a0366d57f72b082023ad6c` | `nexus-vtt2-doc-websocket-1` / `a55bc2e76796` | 3002/tcp internal; `homelab-net` | `on-failure` |
| admin-ui | `ghcr.io/joelmale/nexuscodex-admin-ui:latest`; `.../admin-ui@sha256:0050ae256014d9fa82f579bc1a7a2e1b68c0714fad13667bcce3aa30bad9c0cc` | `nexus-vtt2-admin-ui-1` / `e05695bf453f` | 80/tcp internal; `homelab-net` | `on-failure` |
| dm-ui | `ghcr.io/joelmale/nexuscodex-dm-ui:latest`; `.../dm-ui@sha256:b6a51741eb3a0739c1a3ba78ad0338e20f86253f718a2dcef8903ce5a7af60e4` | `nexus-vtt2-dm-ui-1` / `76f5a4dea2e3` | 80/tcp internal; `homelab-net` | `on-failure` |

The short hostname values above are Docker-generated values from inspect, not
Compose `hostname` declarations. Explicit live Compose names/hostnames exist
only for `asset-server`, `nexus-forge`, and `frontend`; the production draft
retains those three explicit identities. Rehearsal changes them to
`nexus-migration-phase3-e078895-asset-server`,
`nexus-migration-phase3-e078895-forge`, and
`nexus-migration-phase3-e078895-frontend`; other rehearsal containers receive
the exact Compose project namespace (`nexus-migration-phase3-e078895-*`).

## Storage and networks

Live NAS binds (all read-write except the last) are:

| service | source | destination |
|---|---|---|
| postgres | `/mnt/docker-nas-vol1/nexusvtt/postgres` | `/var/lib/postgresql/data` |
| redis | `/mnt/docker-nas-vol1/nexusvtt/redis` | `/data` |
| asset-server | `/mnt/docker-nas-vol1/nexusvtt/assets` | `/app/static-assets/assets` |
| asset-server | `/mnt/docker-nas-vol1/nexusvtt/user-assets` | `/app/static-assets/users` |
| asset-server | `/mnt/docker-nas-vol1/nexusvtt/library-assets` | `/app/assets-data` |
| asset-server | `/mnt/docker-nas-vol1/nexusvtt/tmt-seed` | `/seed/tmt` (ro) |

Live named volumes are `nexus-vtt2-codex-postgres-data` ->
`/var/lib/postgresql/data`, `nexus-vtt2-codex-redis-data` -> `/data`,
`nexus-vtt2-codex-elasticsearch-data` -> `/usr/share/elasticsearch/data`, and
`nexus-vtt2-codex-minio-data` -> `/data`. Live postgres also has an anonymous
volume ID beginning `5ac0e7fbfb40` at `/var/lib/postgresql`, in addition to its
NAS bind. The production draft declares the four named volumes but not that
anonymous mount. The rehearsal override replaces all six live storage inputs
with ten named volumes under the exact
`nexus-migration-phase3-e078895-*` prefix: VTT PostgreSQL, VTT Redis, assets,
user assets, library assets, TMT seed, and four corresponding Codex volumes.
It removes the four production volume declarations with `!reset`.

Production and live use `homelab-net`; the rehearsal override resets it and
declares internal `nexus-migration-phase3-e078895-net`. No live service has a second
network membership. The drafts do not define published host ports.

## Endpoints and environment keys

The documented public route is `https://app.nexusvtt.com`; the reverse proxy
targets `frontend:80`, while the VTT backend proxies internally to
`doc-api:3000` and `doc-websocket:3002`. Internal references are
`postgres:5432`, `redis:6379`, `asset-server:5003`, `codex-postgres:5432`,
`codex-redis:6379`, `codex-elasticsearch:9200`, and `codex-minio:9000`.
`admin-ui` and `dm-ui` are documented internal-only. MinIO console port 9001,
all database/queue ports, `doc-api`, and the document WebSocket are not
published by the inspected stack. Forge serves 8080 to the internal network;
the public routing for it is not stated in the two drafts.

Compose-declared environment keys, grouped by service (values omitted), are:

| service | keys |
|---|---|
| postgres | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `PGDATA` |
| redis | `REDIS_PASSWORD` (command/healthcheck interpolation) |
| asset-server | `NODE_ENV`, `PORT`, `ASSETS_PATH`, `ASSET_SERVICE_SECRET`, `LIBRARY_DATA_PATH`, `LIBRARY_MANIFEST_PATH`; image also defines `ASSET_SEED_SOURCE` |
| frontend | `NODE_ENV` |
| backend | `CORS_ORIGIN`, `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_CALLBACK_URL`, `DOC_API_URL`, `ASSET_API_URL`, `ASSET_SERVICE_SECRET`, `METRICS_AUTH_TOKEN`, `MULTIPLAYER_SLO_COMMIT_P95_MS`, `MULTIPLAYER_SLO_RESYNC_RATE_RATIO`, `MULTIPLAYER_SLO_QUEUE_DEPTH`, `MULTIPLAYER_SLO_HEAP_UTILIZATION_RATIO` |
| codex-postgres | `CODEX_POSTGRES_DB`, `CODEX_POSTGRES_USER`, `CODEX_POSTGRES_PASSWORD` |
| codex-redis | `CODEX_REDIS_PASSWORD` (command interpolation) |
| codex-elasticsearch | `discovery.type`, `xpack.security.enabled`, `ES_JAVA_OPTS` |
| codex-minio | `CODEX_MINIO_ROOT_USER`, `CODEX_MINIO_ROOT_PASSWORD` |
| doc-api | `NODE_ENV`, `PORT`, `DATABASE_URL`, `REDIS_URL`, `ELASTICSEARCH_URL`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE`, `JWT_SECRET`, `AUTH_DISABLED`, `EMBEDDINGS_PROVIDER` |
| doc-processor | `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `ELASTICSEARCH_URL`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE` |
| doc-websocket | `NODE_ENV`, `PORT`, `DATABASE_URL`, `REDIS_URL`, `SESSION_TTL`, `JWT_SECRET`, `ELASTICSEARCH_URL` |
| admin-ui / dm-ui | `VITE_DOC_API_URL`, `VITE_WEBSOCKET_URL` |

Dockhand’s structured environment store reports these additional stack-level
keys: `CODEX_POSTGRES_DB`, `CODEX_POSTGRES_USER`, `NODE_ENV`, `FRONTEND_URL`,
`CORS_ORIGIN`, `POSTGRES_DB`, `POSTGRES_USER`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CALLBACK_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CALLBACK_URL`, `DEV_MODE`,
`VITE_DEV_MODE`, `ASSET_API_URL`, plus secret references
`ASSET_SERVICE_SECRET`, `CODEX_JWT_SECRET`, `CODEX_MINIO_ROOT_PASSWORD`,
`CODEX_MINIO_ROOT_USER`, `CODEX_POSTGRES_PASSWORD`, `CODEX_REDIS_PASSWORD`,
`DATABASE_URL`, `DISCORD_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`,
`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `REDIS_URL`, and `SESSION_SECRET`.
The Dockhand raw `.env` contains no secret values in this record. Rehearsal
adds the `REHEARSAL_*` equivalents named in `compose.rehearsal.yaml` for VTT,
Codex credentials, callbacks, CORS, and metrics; it does not change the
non-secret service endpoint names.

For completeness, inspect also showed image-inherited/runtime keys (not
service configuration keys): VTT postgres adds `PATH`, `GOSU_VERSION`, `LANG`,
`PG_MAJOR`, `PG_VERSION`, `PG_SHA256`, and `DOCKER_PG_LLVM_DEPS`; Codex
  postgres adds the same set; Redis adds `PATH` and `REDIS_VERSION`; Elasticsearch
adds `PATH` and `ELASTIC_CONTAINER`; MinIO adds `PATH`,
`MINIO_ACCESS_KEY_FILE`, `MINIO_SECRET_KEY_FILE`, `MINIO_ROOT_USER_FILE`,
`MINIO_ROOT_PASSWORD_FILE`, `MINIO_KMS_SECRET_KEY_FILE`,
`MINIO_UPDATE_MINISIGN_PUBKEY`, `MINIO_CONFIG_ENV_FILE`, and `MC_CONFIG_DIR`;
VTT Node images add `PATH`, `NODE_VERSION`, and (on the inspected backend)
`PORT`; asset-server additionally has `ASSET_SEED_SOURCE`; Codex Node images
add `PATH`, `NODE_VERSION`, and `YARN_VERSION`; nginx images add `PATH`,
`NGINX_VERSION`, `PKG_RELEASE`, `DYNPKG_RELEASE`, `NJS_VERSION`, and
`NJS_RELEASE` (the VTT frontend also has `ACME_VERSION`); Forge adds `PATH`
and `SSL_CERT_FILE`. Values for all of these were omitted.

## Health, startup, database, and deployment behavior

- Live healthchecks: postgres `pg_isready` every 10s (5 retries); redis
  authenticated `redis-cli ping` every 10s (5 retries); asset-server HTTP
  `/health` every 30s, 20s start period (3 retries); frontend HTTP `/health`
  every 30s, 5s start period (3 retries). Other live services report no
  Docker healthcheck. The draft preserves these four checks.
- VTT image commands are asset-server’s library-seed script then workspace
  start, backend `npm run server:start`, frontend nginx, Forge nginx, and
  postgres’ standard entrypoint. Backend draft dependencies wait for healthy
  postgres, redis, and asset-server. Redis runs append-only mode with a
  password. The custom VTT postgres image copies `server/schema.sql` into the
  init directory and is based on `postgres:18-alpine`; init scripts apply only
  to an empty data directory.
- Codex commands are standard postgres, Redis append-only server,
  Elasticsearch single-node, MinIO `server /data --console-address :9001`,
  doc-api `prisma generate` then `prisma db push --skip-generate` then `tsx`,
  doc-processor `node dist/index.js`, doc-websocket `node dist/index.js`, and
  nginx/entrypoint commands for the UIs. The doc-api Dockerfile therefore has
  startup schema mutation behavior. The Codex service Dockerfiles use Node 22;
  doc-api and doc-websocket package Prisma clients are generated at build time,
  and the processor generates its client during build.
- Live database runtime versions observed from inspect: VTT PostgreSQL 18.6,
  Codex PostgreSQL 16.15, Redis 7.4.11, and Elasticsearch 8.11.0. The drafts
  specify VTT custom postgres digest, Codex `postgres:16-alpine`, Redis
  `7-alpine`, Elasticsearch `8.11.0`, and MinIO release
  `RELEASE.2025-09-07T16-13-09Z`; each external image is pinned to the exact
  live-host digest.
- The production draft retains live service names, the six NAS bind paths, the
  four Codex volume names, public host references, and `homelab-net`, but pins
  ten application images to the candidate digests listed above. Its Swarm
  `deploy` blocks specify replicas/update/resource/restart settings; the live
  inspect shows ordinary Compose restart policies, so the effective behavior
  of those `deploy` fields under Dockhand Compose is unknown.

## Candidate digest and live-image evidence

The ten application candidate digests are the production-draft digests in the
service table. Live inspect returned only floating repository references plus
local content IDs: VTT postgres `sha256:f029a056...`, asset-server
`sha256:77fe82cb...`, backend `sha256:7876945a...`, frontend
`sha256:964552af...`, Forge `sha256:16975038...`, Codex postgres
`sha256:075f7ba6...`, Codex Redis `sha256:1db42cce...`, Elasticsearch
`sha256:16c4a265...`, MinIO `sha256:a1a8bd4a...`, doc-api
`sha256:072c7fc7...`, processor `sha256:54d43dc1...`, websocket
`sha256:88ccb413...`, admin UI `sha256:97cab9c7...`, and DM UI
`sha256:54516442...`. These are truncated local Compose image IDs, not
registry digest equivalences. Live image labels identify Codex revision
`4c583c2e82cc71b6fff732f876c1763e82cd4ccb`, Forge revision
`dc4982471b69f3bbec6f5320554a2f506323e73c`, and Elasticsearch revision
`d9ec3fa628c7b0ba3d25692e277ba26814820b20`; equivalent provenance for the VTT
images is not present in the inspected labels.

## Deterministic mechanical checks performed

Commands were read-only:

```text
docker compose --env-file deploy/homelab/.env.example -f deploy/homelab/compose.yaml config --quiet
production-render-exit=0
docker compose --env-file deploy/homelab/.env.example -f deploy/homelab/compose.yaml -f deploy/homelab/compose.rehearsal.yaml config --quiet
rehearsal-render-exit=0
```

Dockhand calls `list_environments`, `list_stacks`, `get_stack_compose`,
`get_stack_env`, `get_stack_env_raw`, `list_containers`, and
`inspect_container` (all environment 1) succeeded without mutation. Git status
before writing showed the pre-existing modified execution ledger only. No
Docker resource, stack, environment, registry, secret, or recovery artifact
was changed.

## Unknowns and evidence gaps

- No live SQL/schema inspection, migration-ledger comparison, or database
  content inspection was performed; current VTT and Codex schemas are therefore
  not established here.
- The release manifest now maps every candidate digest to the tested monorepo
  SHA. MinIO's exact live digest is locally retained on HomePod, but the remote
  repository was not pullable during preparation; the rehearsal therefore
  requires that local image and sets `pull_policy: never`.
- The live reverse-proxy configuration, public Forge route, TLS termination,
  firewall policy, and actual external endpoint exposure were not inspected.
- Docker inspect reports internal exposed ports, not reachability; no network
  connection tests were run.
- The live Compose has no explicit `container_name`/`hostname` for most
  services, and the exact generated names under the production draft were not
  recreated. Rehearsal’s generated names depend on the project-name invocation.
- The rehearsal override now uses only `REHEARSAL_*` interpolations for every
  database, Redis, MinIO, OAuth, JWT, session, asset, and metrics credential.
  The preflight rejects inherited production placeholders, but no rehearsal
  stack has yet tested runtime contact behavior.
- The live postgres anonymous volume is not represented in the production
  draft; whether it is required by the image/runtime is unknown.
- Compose `deploy` semantics, resource limits, update order, and restart
  behavior under Dockhand’s non-Swarm engine remain unverified.
- No healthcheck was added for Codex services; application readiness beyond
  dependency ordering is unknown.

## Recommended next action

Apply the Phase 3 validation matrix to the rendered definitions and a fully
isolated, disposable rehearsal, after separately obtaining the missing schema,
registry-digest, reverse-proxy, and storage evidence. This inventory does not
approve production cutover or any schema/data operation.
