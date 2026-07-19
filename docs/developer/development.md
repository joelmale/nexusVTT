# Development Guide

## Requirements

- Node.js 26.5.0 or newer in the Node 26 line
- npm 11 or newer
- Docker with Compose for PostgreSQL, Redis, integration, and smoke tests

## Start the project

```bash
npm install
npm run start:all
```

The frontend runs at `http://localhost:5173` and the backend at
`http://localhost:5001`. For focused work, use `npm run dev` and
`npm run server:dev` separately.

## Repository boundaries

- `src/components/`: feature UI and colocated styles
- `src/hooks/`: reusable UI orchestration
- `src/stores/`: Zustand domain stores
- `src/services/`: browser/network adapters
- `server/routes/`: HTTP endpoints
- `server/socket/handlers/`: feature-specific realtime handling
- `server/repositories/`: PostgreSQL access and transactions
- `shared/`: runtime contracts shared across process boundaries
- `services/asset-service/`: independent asset workspace

Use `@/` imports for `src/`. Keep shared contracts independent of both
`src/` and `server/`, and validate unknown transport data at the boundary.

## Realtime changes

PostgreSQL is the durability and serialization boundary. Canonical state must
compare-and-swap the observed `syncToken` and `stateVersion`, commit the
snapshot/token/version together, and ACK only after commit. A conflict returns
the authoritative full tuple and the client rebases. Redis remains ephemeral
fanout, presence, and host-lease coordination.

When adding an ordered mutation, update `DURABLE_EVENT_NAMES`, route acceptance
through `SocketManager.publishOrderedEvent`, and add duplicate/replay coverage.
See [Ordered Event Delivery](../ordered-event-delivery.md).

## Validation

```bash
npm run lint
npm run type-check
npm run check:cycles
npm run test:unit
npm run test:asset-service
npm run test:integration
npm run build:all
```

Database integration cases need `DATABASE_URL`; CI supplies it through
`docker/docker-compose.test.yml`. Realtime or recovery changes also require:

```bash
npm run test:e2e
```

That managed suite builds production containers, uses two isolated browser
contexts and two backend replicas, exercises concurrent updates, and hard-kills
a backend immediately after a game-state ACK.

## Database changes

Update `server/schema.sql` for new databases and add an idempotent SQL file in
`server/migrations/` for existing installations. Apply schema changes before a
rolling backend deployment. Never depend solely on startup repair for a planned
production migration.
