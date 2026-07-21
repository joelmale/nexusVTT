# Nexus VTT Documentation

## Start here

- [Getting Started](getting-started.md)
- [Installation](installation.md)
- [First Game Setup](first-game.md)

## Architecture and development

- [Architecture Overview](architecture.md)
- [Backend Architecture](backend.md)
- [Frontend Architecture](frontend.md)
- [Network and Sessions](network-and-sessions.md)
- [Routing Architecture](routing-architecture.md)
- [Developer Guide](developer/development.md)
- [Testing Guide](developer/testing.md)
- [Dependency Policy](dependency-policy.md)

## Realtime reliability

- [Ordered Event Delivery](ordered-event-delivery.md)
- [Delta-Sync Rollout and Metrics](delta-sync-rollout.md)
- [Server-Authoritative Dice](SERVER_AUTHORITATIVE_DICE.md)
- [Multiplayer Reliability Operations](operations/multiplayer-observability.md)

PostgreSQL is the durable authority for canonical snapshots, sync tokens,
versions, Express sessions, and ordered event history. Redis provides ephemeral
cross-replica fanout, presence, and host leases. A canonical state ACK is sent
only after the snapshot/token/version tuple commits.

## Assets

- [Asset Guide](ASSETS-GUIDE.md)
- [Asset Processing](assets/processing.md)
- [Default Asset Integration](DEFAULT_ASSETS_INTEGRATION.md)
- [Asset Setup](ASSET_SETUP.md)

## Deployment and operations

- [Homelab Production Deployment](HOMELAB_DEPLOYMENT.md)
- [Deployment Quick Reference](DEPLOYMENT_QUICKREF.md)
- [GCP Deployment](GCP_DEPLOYMENT_GUIDE.md)
- [Security Scanning](SECURITY_SCANNING.md)

Existing installations must apply the ordered-event-journal, durable
game-state-commit, and room-entity-version migrations in that order before
rolling the new backend. Run `npm run test:e2e` for browser recovery and
`npm run test:soak:chaos` for multi-room failure-injection coverage.
