# Nexus VTT Reference Index

This file is the entry point for generated or code-adjacent documentation.
Use [README.md](README.md) as the curated human documentation homepage.

Generated documentation should prefer adding stable links here instead of
expanding the human README into an exhaustive inventory.

## Source Map

- Frontend entry: `src/main.tsx`
- Frontend components: `src/components/`
- Hooks: `src/hooks/`
- Zustand stores: `src/stores/`
- Client services: `src/services/`
- Server entry: `server/index.ts`
- Server routes: `server/routes/`
- Asset service: `services/asset-service/`
- Shared types: `shared/types.ts`
- Scripts: `scripts/`
- Docker and Compose: `docker/`

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

## Asset References

- [Asset Guide](ASSETS-GUIDE.md)
- [Asset Processing](assets/processing.md)
- [Asset Setup](ASSET_SETUP.md)
- [Default Asset Integration](DEFAULT_ASSETS_INTEGRATION.md)
- [Asset Service Contract](roadmap/contracts/asset-service-v2.md)

## Roadmaps And Decisions

- [Active Stabilization and Generator Hub Roadmap](roadmap/STABILIZATION_GENERATOR_HUB_EXECUTION_ROADMAP.md)
- [Architecture Decision Records](adr/)
- [Roadmap ADRs](roadmap/ADR/)
- [Archived 2026 A/B/C Roadmap Closeout](roadmap/archive/2026-roadmap-closeout/ROADMAP.md)

## Developer References

- [Getting Started](getting-started.md)
- [Installation](installation.md)
- [Development Guide](developer/development.md)
- [Testing Guide](developer/testing.md)
- [Dependency Policy](dependency-policy.md)
- [Security Scanning](SECURITY_SCANNING.md)
