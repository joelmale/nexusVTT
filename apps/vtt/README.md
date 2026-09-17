# Nexus VTT

The virtual tabletop: real-time multiplayer scenes, tokens, dice, fog, and
initiative, with OAuth authentication and PWA support.

For the monorepo overview and the other Nexus apps, see the
[repository README](../../README.md).

## Quick Start

```bash
cd apps/vtt
npm install
npm run start:all  # PostgreSQL, generator hub, frontend, and backend
```

| Service       | URL                   |
| ------------- | --------------------- |
| Frontend      | http://localhost:5173 |
| Generator Hub | http://localhost:5174 |
| Backend       | http://localhost:5001 |
| Database      | `localhost:5432`      |

`start:all` checks the local infrastructure before starting the application
processes.

## Architecture

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Express.js + WebSocket (`ws`)
- **Durable state:** PostgreSQL — canonical snapshots, ordered event journal,
  and Express sessions
- **Realtime coordination:** Redis — ephemeral fanout, presence, and host leases
- **Client state:** Zustand + Immer, with IndexedDB persistence

PostgreSQL is the durable authority. Redis is never the durable record; losing
it cannot erase an acknowledged game-state commit. A canonical state ACK is sent
only after the snapshot, sync token, and version tuple commits.

See [Architecture Overview](../docs/vtt/architecture.md) and
[Network and Sessions](../docs/vtt/network-and-sessions.md).

## Features

- **Real-time multiplayer** — host and player roles, synchronized sessions,
  durable ACKs, and compare-and-swap conflict recovery across backend replicas
- **Scene editor** — maps, grid, tokens, props, drawing tools, and paintable fog
- **Server-authoritative dice** — cryptographically secure rolls validated
  server-side ([details](../docs/vtt/features/dice.md))
- **OAuth** — Google and Discord, with PostgreSQL-backed sessions
- **Progressive Web App** — service worker, offline capability, installable
- **Hybrid state** — local-first IndexedDB with real-time server sync

## Commands

All commands run from `apps/vtt`.

### Development

```bash
npm run dev              # Frontend only (hot reload)
npm run server:dev       # Backend only (watch mode)
npm run start:all        # Full stack with PostgreSQL
npm run docker:dev       # Docker Compose development
```

### Building

```bash
npm run build           # Frontend build
npm run build:server    # Backend build
npm run build:all       # Both builds
npm run preview         # Preview built frontend
```

### Testing

```bash
npm run test              # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:e2e          # Production Docker + Playwright smoke tests
npm run test:e2e:headed   # Smoke tests with a visible Chromium window
npm run test:soak:managed # Configurable multi-room load test
npm run test:soak:chaos   # Load + backend/Redis/PostgreSQL fault injection
npm run test:ci           # Full CI pipeline (lint + type-check + tests)
npm run test:coverage     # Coverage report
```

### Database

```bash
npm run db:start        # Start PostgreSQL
npm run db:stop         # Stop PostgreSQL
npm run db:reset        # Reset database (deletes all data)
npm run db:shell        # Open psql shell
npm run db:logs         # View PostgreSQL logs
```

### Assets

```bash
npm run organize-assets     # Organize asset files
npm run generate-assets     # Generate thumbnails and manifest
npm run optimize-images     # Optimize image files
```

## Testing Setup

- **Frameworks:** Vitest with Testing Library; Playwright for browser smoke tests
- **Mocks:** WebSocket, IndexedDB, localStorage, sessionStorage
- **Coverage:** 20% lines, 18% functions, 16% branches, 20% statements
- **Environment:** jsdom with custom setup

### Test Categories

- **Unit** — component and utility tests
- **Integration** — database operations and API endpoints
- **End-to-end** — production containers, two isolated clients, replica
  convergence, abrupt `SIGKILL` recovery after an ACK, PWA offline reloads,
  WebSocket reconnection, and dice runtime assets
- **Load/soak** — 50-100 rooms with 4-8 isolated clients each, mixed
  chat/dice/scene/token/state traffic, identity-preserving reconnects,
  cross-replica conflict probes, zero-loss/duplicate checks, and final hash
  convergence. Chaos mode restarts both backends, interrupts Redis, and injects
  PostgreSQL latency through Toxiproxy.

See the [Testing Guide](../docs/vtt/developer/testing.md).

## Security

- OAuth2 with Google and Discord; JWT-based session management
- Helmet security headers, input validation, CORS configuration
- Prepared statements for database queries; rate limiting on API endpoints
- Server-side session storage in PostgreSQL
- Redis restricted to ephemeral realtime coordination

## Deployment

Production is deployed via Dockhand using `deploy/homelab/compose.yaml` at the
repository root.

> only. It is not the production stack and should not be used for production deployment.

See [DEPLOYMENT.md](../../DEPLOYMENT.md) and
[NexusCodex Homelab Deployment](../docs/codex/operations/nexuscodex-homelab.md)
for production topology.

### Health endpoints

In a same-origin production deployment, `/health` is the frontend nginx probe
and returns plain text. Use `/api/system/health` for the backend dependency and
realtime-coordinator health response.

### Configuration

Copy `.env.example` to `.env` and fill in the values before starting.

#### Required environment variables

| Variable                | Description                                                  | Example                                          |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| `DATABASE_URL`          | PostgreSQL connection string                                 | `postgresql://nexus:pass@localhost:5432/nexus`   |
| `POSTGRES_PASSWORD`     | Postgres superuser password (used by the postgres container) | `change-me`                                      |
| `REDIS_PASSWORD`        | Redis auth password                                          | `change-me`                                      |
| `JWT_SECRET`            | Signs JWT tokens — use a long random string                  | `openssl rand -hex 64`                           |
| `SESSION_SECRET`        | Signs session cookies — use a long random string             | `openssl rand -hex 64`                           |
| `GOOGLE_CLIENT_ID`      | Google OAuth 2.0 client ID                                   | `xxx.apps.googleusercontent.com`                 |
| `GOOGLE_CLIENT_SECRET`  | Google OAuth 2.0 client secret                               | —                                                |
| `GOOGLE_CALLBACK_URL`   | Absolute HTTPS URL registered in Google Cloud Console        | `https://app.nexusvtt.com/auth/google/callback`  |
| `DISCORD_CLIENT_ID`     | Discord application client ID                                | —                                                |
| `DISCORD_CLIENT_SECRET` | Discord application client secret                            | —                                                |
| `DISCORD_CALLBACK_URL`  | Absolute HTTPS URL registered in your Discord application    | `https://app.nexusvtt.com/auth/discord/callback` |

#### Optional / local container variables

| Variable         | Default                     | Description                                                                                                                                                                                             |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SECURE_COOKIES` | `true` (production)         | Set to `false` only in non-TLS local environments. Controls the `Secure` flag on session cookies. **Note:** `FORCE_HTTPS` no longer exists — it was removed as it only accidentally disabled this flag. |
| `IMAGE_PREFIX`   | `ghcr.io/joelmale/nexusvtt` | Container registry prefix used by local/component Compose                                                                                                                                               |
| `VERSION`        | `latest`                    | Image tag used by local/component Compose                                                                                                                                                               |
| `POSTGRES_USER`  | `nexus`                     | Postgres username                                                                                                                                                                                       |
| `POSTGRES_DB`    | `nexus`                     | Postgres database name                                                                                                                                                                                  |
| `CORS_ORIGIN`    | `http://localhost:5173`     | Comma-separated list of allowed CORS origins                                                                                                                                                            |

#### Proxy / SSL notes

nginx only terminates HTTP internally (port 80). TLS is terminated by the outer
reverse proxy (Traefik, Cloudflare, etc.), which must forward
`X-Forwarded-Proto: https` — nginx passes this through unchanged to the backend.
The backend is configured with `trust proxy: 1`, so `req.protocol` and session
cookie security derive from that header, not the internal connection.

### Migrations

For an existing database, first apply
`server/migrations/2026-01-05-add-campaign-roomcode.sql`, then apply all three
2026-07-19 migrations in order before rolling new backend replicas:

1. `add-room-event-journal.sql`
2. `add-durable-game-state-commits.sql`
3. `add-room-entity-versions.sql`

The last table makes token and prop version checks atomic across replicas. New
databases receive the same objects from `server/schema.sql`.

### Observability

The backend exposes a Prometheus endpoint at `/metrics` and a structured SLO
snapshot at `/api/metrics/multiplayer`. Start the optional Prometheus/Grafana
overlay with:

```bash
docker compose -f docker/docker-compose.dev.yml \
  -f docker/docker-compose.observability.yml up -d
```

See [Multiplayer Reliability Operations](../docs/vtt/operations/multiplayer-observability.md)
for SLOs, alerts, OpenTelemetry export, load profiles, and the staging runbook.

## Troubleshooting

- **Port conflicts** — use `npm run start:all` for automatic resolution
- **Database connection** — verify Docker is running
- **Build errors** — check TypeScript configuration
- **Database issues** — check logs with `npm run db:logs`
- **CSS and layout** — see [CSS_TROUBLESHOOTING.md](../../CSS_TROUBLESHOOTING.md)

## Documentation

- [Architecture Overview](../docs/vtt/architecture.md)
- [Frontend Architecture](../docs/vtt/frontend.md)
- [Backend Architecture](../docs/vtt/backend.md)
- [Network and Sessions](../docs/vtt/network-and-sessions.md)
- [Ordered Event Delivery](../docs/vtt/ordered-event-delivery.md)
- [Delta-Sync Rollout](../docs/vtt/delta-sync-rollout.md)
- [Asset Guide](../docs/vtt/ASSETS-GUIDE.md)
- [Architecture Decision Records](../docs/vtt/adr/)
