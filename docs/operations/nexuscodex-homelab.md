# NexusCodex homelab deployment

This runbook records the NexusCodex deployment inside the Dockhand-managed
`nexus-vtt2` stack on `192.168.100.20`. It supplements the general integration
design in [`docs/NEXUSCODEX_INTEGRATION.md`](../NEXUSCODEX_INTEGRATION.md).

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
`doc-websocket`, plus the internal-only `admin-ui` and `dm-ui`. The dependency
services are deliberately prefixed with `codex-` so they cannot collide with
NexusVTT's own PostgreSQL and Redis services.

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

For a manual UI check:

1. Open `https://app.nexusvtt.com` and start a guest or quick game.
2. Open the Document Library.
3. Confirm the library loads without the "Document service unavailable" error.
4. Confirm Dockhand shows all `nexus-vtt2-doc-*` and `nexus-vtt2-codex-*`
   containers running with no restart loop.

## Browser file-transfer limitation

Health, document listing, metadata, and search are integrated. Browser upload
and content URLs still require a public object-storage route. NexusCodex signs
MinIO URLs, but MinIO currently remains private as
`http://codex-minio:9000`. Publishing its console or raw API ports is not an
acceptable workaround.

Complete file transfer by doing one of the following:

1. Add a dedicated TLS hostname such as `codex-storage.nexusvtt.com` in the
   existing reverse proxy, forward it to `codex-minio:9000`, and set
   `S3_PUBLIC_ENDPOINT` on `doc-api` to that hostname.
2. Preferably, add authenticated upload/content streaming routes to the
   NexusVTT backend so browsers never receive an internal Docker hostname or a
   directly exposed object-store endpoint.

Also update `DocumentServiceClient.getDocumentContentUrl()` before declaring
file viewing complete: it currently builds a URL from the internal
`DOC_API_URL`, which a browser cannot resolve.

## Rollback and Dockhand caution

The pre-integration Compose definition is preserved at
[`docker/rollback/nexus-vtt2-compose-before-nexuscodex-20260721.yaml`](../../docker/rollback/nexus-vtt2-compose-before-nexuscodex-20260721.yaml).
Restoring it does not delete the four Codex volumes.

The installed Dockhand API returns raw environment data as
`{ "content": "..." }`. Any automation updating `/env/raw` must read that
`content` property, merge by key, and write the complete result. A blind PUT has
replace semantics and can remove unrelated stack variables.
