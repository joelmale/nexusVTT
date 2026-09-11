# NexusCodex Integration

NexusCodex is a separate document-service system integrated with Nexus VTT
through the VTT backend. It is not an asset service and should not absorb Atlas
or TMT asset responsibilities.

## Current Status

As of the current homelab deployment:

- Document health checks work through the VTT backend.
- Authenticated document listing works.
- Metadata and search routes are integrated.
- Browser upload/content transfer still needs either a public object-storage
  route or authenticated backend streaming.
- Google and Discord OAuth values must be present in Dockhand for provider login.

The canonical operations runbook is
[NexusCodex Homelab Deployment](operations/nexuscodex-homelab.md).

## Architecture

```text
browser
  -> app.nexusvtt.com
  -> Nexus VTT frontend
  -> Nexus VTT backend authenticated proxy
  -> doc-api / doc-websocket
  -> codex-postgres, codex-redis, codex-elasticsearch, codex-minio
```

`DOC_API_URL=http://doc-api:3000` enables the backend proxy. The document API is
private to the Compose network.

## Boundaries

- Nexus VTT owns user authentication, sessions, game state, scene state, and
  asset persistence.
- NexusCodex owns document metadata, document search, document processing, and
  document object storage.
- Atlas can query NexusCodex as a federated read-only source.
- Asset-library reads and writes stay in `services/asset-service`.

See [roadmap ADR-0001](roadmap/ADR/0001-nexuscodex-boundary.md) and
[asset-service contract v2](roadmap/contracts/asset-service-v2.md).

## Current Routes

Document routes are mounted through the VTT backend under `/api`, including:

- `/api/documents`
- `/api/documents/:id`
- `/api/documents/:id/content`
- `/api/documents/:id/thumbnail`
- `/api/search`
- `/api/search/quick`
- `/api/health` for document-service health

Use `/api/system/health` for VTT backend/database/realtime readiness.

## Known Gap

NexusCodex currently signs MinIO URLs, but the browser cannot use private Docker
hostnames such as `http://codex-minio:9000`. Complete file transfer by choosing
one path:

1. Publish a dedicated TLS object-storage hostname and set `S3_PUBLIC_ENDPOINT`.
2. Preferably, add authenticated upload/content streaming through the VTT
   backend so object storage remains private.

## Operations

- Live runbook: [operations/nexuscodex-homelab.md](operations/nexuscodex-homelab.md)
- Production deployment: [../DEPLOYMENT.md](../DEPLOYMENT.md)
- Homelab deployment: [HOMELAB_DEPLOYMENT.md](HOMELAB_DEPLOYMENT.md)
