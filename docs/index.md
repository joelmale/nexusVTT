# Nexus VTT Reference Index

This file is the entry point for generated or code-adjacent documentation.
Use [README.md](README.md) as the curated human documentation homepage.

VTT application paths and commands below are relative to `apps/vtt` unless a
repository-root path is stated explicitly.

Generated documentation should prefer adding stable links here instead of
expanding the human README into an exhaustive inventory.

## Source Map

- Frontend entry: `apps/vtt/src/main.tsx`
- Frontend components: `apps/vtt/src/components/`
- Hooks: `apps/vtt/src/hooks/`
- Zustand stores: `apps/vtt/src/stores/`
- Client services: `apps/vtt/src/services/`
- Server entry: `apps/vtt/server/index.ts`
- Server routes: `apps/vtt/server/routes/`
- Asset service: `apps/vtt/services/asset-service/`
- Shared types: `apps/vtt/shared/types.ts`
- Scripts: `apps/vtt/scripts/`
- Docker and Compose: `apps/vtt/docker/`

## Architecture References

- [Architecture Overview](architecture.md)
- [Backend Architecture](backend.md)
- [Frontend Architecture](frontend.md)
- [Network and Sessions](network-and-sessions.md)
- [Routing Architecture](routing-architecture.md)
- [Ordered Event Delivery](ordered-event-delivery.md)
- [Delta-Sync Rollout and Metrics](delta-sync-rollout.md)
- [Server-Authoritative Dice](SERVER_AUTHORITATIVE_DICE.md)

## Operations References

- [Production Deployment](../DEPLOYMENT.md)
- [Homelab Deployment](HOMELAB_DEPLOYMENT.md)
- [Deployment Quick Reference](DEPLOYMENT_QUICKREF.md)
- [Reverse Proxy Configuration Notes](NPM_CONFIGURATION.md)
- [Multiplayer Observability](operations/multiplayer-observability.md)
- [NexusCodex Homelab Deployment](operations/nexuscodex-homelab.md)
- [Cloud Deployment Options](cloud/)

## Asset References

- [Asset Guide](ASSETS-GUIDE.md)
- [Asset Processing](assets/processing.md)
- [Asset Setup](ASSET_SETUP.md)
- [Default Asset Integration](DEFAULT_ASSETS_INTEGRATION.md)
- [Asset Service Contract](roadmap/contracts/asset-service-v2.md)

## Roadmaps And Decisions

- [Active Stabilization and Generator Hub Roadmap](roadmap/STABILIZATION_GENERATOR_HUB_EXECUTION_ROADMAP.md)
- [Canonical Architecture Decision Records](adr/)
- [Historical Roadmap ADRs](roadmap/ADR/)
- [Archived 2026 A/B/C Roadmap Closeout](roadmap/archive/2026-roadmap-closeout/ROADMAP.md)

## Developer References

- [Getting Started](getting-started.md)
- [Installation](installation.md)
- [Development Guide](developer/development.md)
- [Testing Guide](developer/testing.md)
- [Dependency Policy](dependency-policy.md)
- [Security Scanning](SECURITY_SCANNING.md)
