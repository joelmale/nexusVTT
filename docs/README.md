# Nexus VTT Documentation

This is the curated human entry point for the project docs. For generated or
code-adjacent reference material, use [Reference Index](index.md).

## Start here

- [Getting Started](getting-started.md)
- [Installation](installation.md)
- [First Game Setup](first-game.md)

## Architecture and development

- [Architecture Overview](architecture.md)
- [Canonical ADRs](adr/)
- [Historical Roadmap ADRs](roadmap/ADR/)
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
- [Reverse Proxy Configuration Notes](NPM_CONFIGURATION.md)
- [NexusCodex Homelab Deployment](operations/nexuscodex-homelab.md)
- [Cloud Deployment Options](cloud/)
- [Security Scanning](SECURITY_SCANNING.md)

## Archived project history

- [2026 A/B/C Roadmap Closeout](roadmap/archive/2026-roadmap-closeout/ROADMAP.md)

Existing installations must apply the ordered-event-journal, durable
game-state-commit, and room-entity-version migrations in that order before
rolling the new backend. Run `npm run test:e2e` for browser recovery and
`npm run test:soak:chaos` for multi-room failure-injection coverage.
