# Nexus VTT DoDAF v2.02 Architecture Artifacts

This directory contains DoDAF-oriented architecture documentation generated from
repository inspection of source code, Dockerfiles, Docker Compose files,
TypeScript models, REST and WebSocket routes, database schema, and existing
architecture notes.

## Artifact Index

| Model | File | Description |
| --- | --- | --- |
| AV-1 | [AV-1.md](./AV-1.md) | Executive summary, scope, capabilities, constraints, assumptions |
| AV-2 | [AV-2.md](./AV-2.md) | Integrated dictionary, glossary, acronyms, naming conventions |
| SV-1 | [SV-1.md](./SV-1.md) | Systems interface description and multi-container system composition |
| SvcV-1 | [SvcV-1.md](./SvcV-1.md) | Services context and composition |
| SV-2 | [SV-2.md](./SV-2.md) | Systems resource flow description |
| SvcV-2 | [SvcV-2.md](./SvcV-2.md) | Services resource flow description |
| SV-4 | [SV-4.md](./SV-4.md) | Systems functionality description |
| SvcV-4 | [SvcV-4.md](./SvcV-4.md) | Services functionality description |
| DIV-1 | [DIV-1.md](./DIV-1.md) | Conceptual data model |
| DIV-2 | [DIV-2.md](./DIV-2.md) | Logical data model |
| DIV-3 | [DIV-3.md](./DIV-3.md) | Physical data model and implementation |
| StdV-1 | [StdV-1.md](./StdV-1.md) | Standards profile |

## Notes

- The production topology is primarily derived from `docker/docker-compose.yml`,
  `docker/frontend.Dockerfile`, `docker/backend.Dockerfile`,
  `docker/postgres.Dockerfile`, and `docker/nginx.conf`.
- Data models are derived from `server/schema.sql`, `server/database.ts`,
  `server/types.ts`, `shared/types.ts`, `src/types/**`, and browser persistence
  services under `src/services`.
- Redis is provisioned in production Compose and checked during backend startup,
  but no runtime Redis client usage was found in the inspected backend code.
- Active WebSocket rooms and connections are in backend process memory. With
  multiple backend replicas, production operation needs sticky routing or a
  shared coordination/pub-sub layer for cross-replica room state.
