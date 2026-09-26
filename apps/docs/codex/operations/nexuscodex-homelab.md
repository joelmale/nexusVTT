# NexusCodex homelab deployment

This runbook records the NexusCodex deployment inside the Dockhand-managed
`nexus-vtt2` stack on `192.168.100.20`. It supplements the general integration
design in the [NexusCodex integration guide](/platform/integrations/NEXUSCODEX_INTEGRATION).

## Live topology

NexusVTT reaches NexusCodex through the private `homelab-net` Docker network:

```text
browser -> app.nexusvtt.com -> NexusVTT backend -> http://doc-api:3000
                                                -> doc-websocket:3002

doc-api/doc-processor -> codex-postgres
                      -> codex-redis
                      -> codex-elasticsearch
                      -> codex-minio
```

The stack contains one replica each of `doc-api`, `doc-processor`, and
`doc-websocket`. The static user interfaces (`dm-ui` at `/codex-dm/` and
`admin-ui` at `/codex-admin/`, along with Character Forge at `/forge/`) are
hosted directly from disk by the consolidated `nexus-vtt2-frontend` gateway,
eliminating redundant internal Nginx containers and exposed debug ports (`3080`,
`3081`). The dependency services are deliberately prefixed with `codex-` so they
cannot collide with NexusVTT's own PostgreSQL and Redis services.

> Phase 0 of [the private admin control plane
> plan](/platform/private-admin-control-plane) removes public reachability of
> the Codex Admin UI entirely: the public gateway's `/codex-admin/` location
> now returns `404` instead of serving the SPA from disk, and the `admin-ui`
> and `dm-ui` containers no longer publish host ports `3080`/`3081` at all.
> `doc-api` also leaves the shared `homelab-net` for the internal-only
> `nexus-internal-net`. This section describes the pre-Phase-0 topology; it is
> in-repo but **not yet deployed** as of this writing. The Codex Admin UI has
> no reachable path until Phase 1 stands up the private admin hostname. The DM
> UI at `/codex-dm/` is unaffected.

Persistent data uses the following named volumes:

- `nexus-vtt2-codex-postgres-data`
- `nexus-vtt2-codex-redis-data`
- `nexus-vtt2-codex-elasticsearch-data`
- `nexus-vtt2-codex-minio-data`

`DOC_API_URL=http://doc-api:3000` enables the NexusVTT document proxy.
`AUTH_DISABLED=true` is intentional on `doc-api`: NexusVTT authenticates and
authorizes users before proxying requests. Do not publish `doc-api` directly or
attach it to an untrusted network while that setting is enabled.

## Secrets and OAuth

Codex PostgreSQL, Redis, MinIO, and JWT credentials are generated values stored
as encrypted Dockhand variables. Non-secret settings are stored in the stack's
`.env` file because Docker Compose reads that file during deployment.

Google and Discord OAuth currently use explicit disabled placeholders. Guest
and quick-game authentication works, but provider login will not work until all
four provider values are restored in Dockhand:

- `GOOGLE_CLIENT_ID` and `DISCORD_CLIENT_ID` as ordinary variables
- `GOOGLE_CLIENT_SECRET` and `DISCORD_CLIENT_SECRET` as encrypted secrets

Redeploy `nexus-vtt2` after restoring them. Never commit provider credentials to
this repository.

## Validation

On 2026-07-21 the following checks passed through both the Cloudflare route and
the direct LAN route (`--resolve app.nexusvtt.com:443:192.168.100.20`):

```powershell
curl.exe https://app.nexusvtt.com/api/health
curl.exe https://app.nexusvtt.com/api/metrics/multiplayer
```

`/api/health` returned `200` with `database: connected` from NexusCodex.
`/api/metrics/multiplayer` returned `200` from NexusVTT. A cookie-backed guest
session also created successfully and `GET /api/documents?limit=5` returned
`200`, proving that the browser-facing NexusVTT route can call `doc-api`.

Note for future repeats of this check: as of the Phase 0 admin-control-plane
work (pending deployment, see above), `/api/metrics/multiplayer` and the other
`/api/metrics/*` routes require `Authorization: Bearer $METRICS_AUTH_TOKEN`;
an unauthenticated request will return `401` once that change ships.

For a manual UI check:

1. Open `https://app.nexusvtt.com` and start a guest or quick game.
2. Open the Document Library.
3. Confirm the library loads without the "Document service unavailable" error.
4. Confirm Dockhand shows all `nexus-vtt2-doc-*` and `nexus-vtt2-codex-*`
   containers running with no restart loop.

## Document upload and processing limits

The private Admin UI sends uploads through the authenticated control API;
object-storage URLs remain internal. A document may be at most 320 MiB. The
gateway permits a 321 MiB multipart body so form framing does not consume part
of the file allowance.

The doc-processor renders reader page images and OCR input for at most 350
pages per document. The homelab defaults can be tuned without rebuilding the
worker image:

```env
CODEX_PAGE_IMAGE_MAX_PAGES=350
CODEX_OCR_MAX_PAGES=350
```

These values are coverage limits, not concurrency settings. The worker keeps
`WORKER_CONCURRENCY=2`, `ASSET_WORKER_CONCURRENCY=1`, and
`OCR_WORKER_POOL_SIZE=2` by default. A large image-only PDF can therefore take
substantially longer to process and can temporarily use the original file
size plus rendered PNG data, while permanent storage gains one WebP image per
rendered page. Upload large scans one at a time until worker memory, CPU time,
queue depth, and object-storage growth have been measured on the homelab.

Current rendering collects page buffers before their next stage. Before
raising either page limit beyond 350, change OCR and page-image generation to
render, upload, and release bounded batches instead of retaining every page in
memory.

## Dockhand caution

The installed Dockhand API returns raw environment data as
`{ "content": "..." }`. Any automation updating `/env/raw` must read that
`content` property, merge by key, and write the complete result. A blind PUT has
replace semantics and can remove unrelated stack variables.
