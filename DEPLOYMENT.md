# Nexus VTT Production Deployment

The primary production deployment is managed via Dockhand using the `deploy/homelab/compose.yaml` stack definition. The migration to the monorepo structure is complete.

## Production Topology

The live `nexus-vtt2` stack comprises 15 services (VTT, Forge, Codex, and data stores) running on the `homelab-net` Docker network.

**Important:** Do not run `docker stack deploy` or point Dockhand at `apps/vtt/docker/docker-compose.yml`. That file remains a component-local development stack.

For detailed deployment parameters, volumes, and network specifics, see the
[homelab deployment runbook](apps/docs/codex/operations/nexuscodex-homelab.md).

## Local/component development

From the repository root, use the VTT development stack:

```bash
make dev
make dev-logs
make dev-stop
```

Or run the VTT-local workflow directly:

```bash
cd apps/vtt
npm run start:all
```

These commands are for local development and do not represent the production topology. Local observability overlays must also use the development Compose file, when supported by the component.

## Required Migrations and Health

Before updating backend replicas on an existing database, ensure the following migrations have been applied:

1. `2026-01-05-add-campaign-roomcode.sql`
2. The three `2026-07-19` durability migrations (event-journal, game-state, entity-version order).

Health checks:

- `/health` is the frontend probe.
- `/api/system/health` provides backend database and realtime-coordinator readiness.
