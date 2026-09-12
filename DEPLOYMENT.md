# Nexus VTT Production Deployment Status

> **PRODUCTION BLOCKED:** `apps/vtt/docker/docker-compose.yml` is a
> component-local VTT Compose file. It is not the live 15-service stack and
> must not be imported into Dockhand, deployed with Docker Swarm, or used as a
> production deployment input.

Production cutover is not complete. The intended production input is the
not-yet-complete `deploy/homelab/compose.yaml`, coordinated with
`docs/operations/monorepo-migration-execution-ledger.md`. Phase 3 is not
complete; do not infer readiness from this document.

## Production readiness

There is no approved root production Compose input in this checkout yet. The
generic VTT-only Compose file remains useful for local/component development
only. No root command in this repository is an approved production deploy,
Dockhand, or Swarm procedure.

Do not run `docker stack deploy`, point Dockhand at
`apps/vtt/docker/docker-compose.yml`, or use that file on a production Docker
host. These actions are intentionally unsupported until the homelab package and
ledger gates are complete.

The execution ledger records the remaining approvals, rehearsal, and cutover
work. Production guidance must be updated only after that work produces the
`deploy/homelab/compose.yaml` input and explicitly clears Phase 3.

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

These commands are for local development and do not represent the production
topology. Local observability overlays must also use the development Compose
file, when supported by the component.

## Future production handoff

When the migration package is complete, update this document from the
execution ledger and point operators to `deploy/homelab/compose.yaml`. That
future procedure must document the live 15-service topology, Dockhand ownership,
required migrations, health checks, rollback, and the Swarm decision if one is
needed. None of those production steps are authorized by this status document.
