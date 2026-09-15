# Nexus

A suite of tools for running tabletop RPGs in the browser: a real-time virtual
tabletop, a D&D 5e character builder, and a document library for campaign
material.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

This is a monorepo. Each application is independently buildable and has its own
README with setup instructions, commands, and configuration.

## The applications

| App                           | Path         | What it is                                                                           | Dev port  |
| ----------------------------- | ------------ | ------------------------------------------------------------------------------------ | --------- |
| **[Nexus VTT](apps/vtt/)**    | `apps/vtt`   | The virtual tabletop — scenes, tokens, dice, fog, initiative, real-time multiplayer  | 5173      |
| **[NexusForge](apps/forge/)** | `apps/forge` | D&D 5e character generator and sheet manager; 100% client-side, no backend           | 3000      |
| **[NexusCodex](apps/codex/)** | `apps/codex` | Document library microservice stack — ingestion, search, and real-time collaboration | 3001–3005 |

Nexus VTT is the primary application; Forge and Codex are consumed by it but
also run standalone.

## How they fit together

The apps are separate deployables that meet at explicit, versioned contracts in
`packages/` rather than by importing each other's internals.

```text
                  ┌──────────────────────────────┐
                  │          Nexus VTT           │
                  │  scenes · tokens · dice      │
                  └──────────────────────────────┘
                       ▲                    ▲
   character import    │                    │   documents proxied through
   + module federation │                    │   the VTT backend
                       │                    │
        ┌──────────────────────┐   ┌────────────────────────┐
        │      NexusForge      │   │      NexusCodex        │
        │  character sheets    │   │  document library      │
        └──────────────────────┘   └────────────────────────┘
                  │                            │
    @nexus/character-contracts    @nexus/document-contracts
```

- **Forge → VTT.** Characters are exported from Forge and imported by the VTT
  through `ForgeCharacterAdapter`, validated against
  `@nexus/character-contracts`. Forge also exposes `./CharacterSheet` and
  `./dbService` over Vite module federation as the `nexus_forge` remote.
- **Codex → VTT.** Documents reach the browser through the VTT backend, not
  directly, and are typed by `@nexus/document-contracts`. Codex is a document
  service and deliberately does not own asset responsibilities — see
  [NexusCodex Integration](apps/docs/platform/integrations/NEXUSCODEX_INTEGRATION.md).

## Repository layout

```text
apps/
  vtt/                    Virtual tabletop (React 19, Express, PostgreSQL, Redis)
    apps/generator-hub/   Map generator front-end
    services/asset-service/
  forge/                  Character generator (React, Vite, IndexedDB)
  codex/                  Document library
    services/doc-api/         Fastify + Prisma
    services/doc-processor/   BullMQ worker
    services/doc-websocket/   Realtime collaboration
    services/admin-ui/        Admin dashboard
    services/dm-ui/           DM-facing UI
packages/
  character-contracts/    @nexus/character-contracts — shared character schema
  document-contracts/     @nexus/document-contracts — shared document schema
deploy/homelab/           Production Compose stack (Dockhand)
  docs/                   Unified Docusaurus documentation application
monitoring/               Prometheus, Grafana, and alert rules
```

## Getting started

### Prerequisites

- **Node.js 26.5.0** (see `.nvmrc`) and **npm 11+** — required by the VTT.
  Codex services accept Node 22+, but the repo toolchain targets 26.5.0.
- **Docker Desktop** — required for the VTT (PostgreSQL, Redis) and Codex.
- Forge needs neither: it is fully client-side.

### Run one app

Each app is self-contained. Pick the one you are working on:

```bash
# Virtual tabletop — starts PostgreSQL, Redis, frontend, and backend
cd apps/vtt && npm install && npm run start:all
```

```bash
# Character generator — no backend, no Docker
cd apps/forge && npm install && npm run dev
```

```bash
# Document library — full service stack
cd apps/codex && docker compose up -d
```

See each app's README for commands, configuration, and testing:
[VTT](apps/vtt/README.md) · [Forge](apps/forge/README.md) ·
[Codex](apps/codex/README.md).

### Work across apps

The repository root is an npm workspace with orchestration scripts for
installing, building, and testing each app from one place:

```bash
npm run install:vtt    # or install:forge, install:codex
npm run build:vtt      # or build:forge, build:codex
npm run test:vtt       # or test:forge, test:codex
```

A `Makefile` wraps the common Docker workflows — run `make help` for the full
list of targets (`dev`, `build`, `test`, `clean`, `health-check`).

## Documentation

Browse the [published Nexus documentation](https://joelmale.github.io/nexusVTT/)
or start locally at the [documentation application](apps/docs/README.md).

| Topic        | Entry point                                                                        |
| ------------ | ---------------------------------------------------------------------------------- |
| Architecture | [Architecture Overview](apps/docs/vtt/architecture.md)                             |
| Realtime     | [Network and Sessions](apps/docs/vtt/network-and-sessions.md)                      |
| Decisions    | [Architecture Decision Records](apps/docs/vtt/adr/)                                |
| Development  | [Developer Guide](apps/docs/vtt/developer/development.md)                          |
| Testing      | [Testing Guide](apps/docs/vtt/developer/testing.md)                                |
| Deployment   | [DEPLOYMENT.md](DEPLOYMENT.md) · [Homelab](apps/docs/vtt/HOMELAB_DEPLOYMENT.md)    |
| Operations   | [Multiplayer Observability](apps/docs/vtt/operations/multiplayer-observability.md) |

Contributor and agent conventions — structure, commands, code style, testing
gates, and PR expectations — live in [AGENTS.md](AGENTS.md).

## Contributing

1. Create a feature branch from `master`
2. Make your changes, with tests
3. Run lint and type-check for the app you touched
4. Open a pull request

All changes should include tests, pass lint and type-check, meet coverage
thresholds, and update documentation where behavior changes. See
[CONTRIBUTING.md](CONTRIBUTING.md) for detail.

Report bugs and request features at
[github.com/joelmale/nexusVTT/issues](https://github.com/joelmale/nexusVTT/issues).

## License

MIT — see [LICENSE](LICENSE).
