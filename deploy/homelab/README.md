# Homelab Compose draft

`compose.yaml` is the Phase 3 production source definition for the existing
Dockhand stack named `nexus-vtt2`. It was transcribed from the sanitized live
definition: service names, container identities, NAS mounts, Codex volume
names, `homelab-net`, and the production reverse-proxy target `frontend:80`
are deliberate compatibility constraints. It pins the ten application images
to the verified `candidate-e078895` index digests. Redis, Elasticsearch, and
MinIO retain the live image references because they are not candidate builds.

This directory is a draft only. Do not use it to create, update, or recreate a
Dockhand stack. The production stack's raw `.env` and encrypted variable store
must be read and merged by an operator; never overwrite either store with this
example file.

## Deterministic renders

From the repository root, use the example values only to validate syntax and
the resolved object graph. `docker compose config` does not start containers,
pull images, connect to Dockhand, or contact production.

```powershell
docker compose --env-file deploy/homelab/.env.example -f deploy/homelab/compose.yaml config
docker compose --env-file deploy/homelab/.env.example -f deploy/homelab/compose.yaml -f deploy/homelab/compose.rehearsal.yaml config
```

The second command resolves the isolated `nexus-vtt2-rehearsal` project. It
uses `nexus-vtt2-rehearsal-net` (an internal, non-external network), unique
container names, named disposable volumes for all former NAS binds and Codex
volumes, test credentials, and `.invalid` callback/origin endpoints. It has no
published ports and must not be connected to the existing reverse proxy or
`homelab-net`.

For a real rehearsal, populate only `REHEARSAL_*` variables with disposable
values and restored/sanitized data. Do not provide production OAuth, database,
Redis, MinIO, JWT, session, asset-service, or metrics credentials. The
`doc-api` startup command still runs `prisma db push`; inspect its candidate
schema against restored data before any non-disposable deployment.
