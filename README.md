# 🎲 Nexus VTT

**Modern virtual tabletop with real-time multiplayer, OAuth authentication, and PWA capabilities.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

## Quick Start

```bash
npm install
npm run start:all  # Starts PostgreSQL, Redis, and both services
```

**Access:**

- Frontend: http://localhost:5173
- Backend: http://localhost:5001
- Database: `localhost:5432`

## 🏗️ Architecture

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Express.js + WebSocket + PostgreSQL + Redis
- **State Management:** Zustand with immer + IndexedDB persistence
- **Authentication:** OAuth2 (Google/Discord) + PostgreSQL-backed sessions
- **Deployment:** Docker Swarm + Nginx Proxy Manager

PostgreSQL is the durable authority for canonical game state and ordered
multiplayer history. Redis provides cross-replica fanout, expiring presence,
and host leases; losing Redis cannot erase an acknowledged game-state commit.

## ✨ Features

### 🔄 Real-time Multiplayer

- Host and player roles with synchronized sessions
- Real-time dice rolling and game state updates
- WebSocket communication for instant updates
- Session persistence across browser refreshes
- Durable ACKs: snapshot, content hash, and version commit atomically before
  the browser is told an update succeeded
- Compare-and-swap conflict recovery across backend replicas

### 🔐 OAuth Authentication

- Google OAuth2 integration
- Discord OAuth2 integration
- JWT-based session management
- Secure token handling with environment variables

### 📱 Progressive Web App

- Service worker for offline capabilities
- Installable web application
- App manifest for mobile devices
- Background sync for data consistency

### 🔄 Hybrid State Management

- Local-first architecture with IndexedDB
- Real-time synchronization with server
- Conflict resolution for concurrent edits
- Optimistic updates for better UX

### 🎲 3D Dice Rolling

- Physics-based dice simulation
- Multiple dice types and themes
- Realistic collision detection
- Customizable dice appearance

### 📋 Scene Editor

- Grid-based map system
- Token and prop placement
- Drawing tools for custom maps
- Layer management for complex scenes

### 🖼️ Asset Management

- Asset categorization (Maps, Tokens, Art, Handouts, Reference)
- Thumbnail generation and optimization
- Search and categorization functionality
- Custom token creation tools

### 📚 Document Integration

- NexusCodex for rule references
- Document sharing and collaboration
- PDF integration for rulebooks
- Rich text editing capabilities

### 🎨 Glassmorphism UI

- Modern glassmorphism design
- Themeable styling system
- Responsive design for all devices
- Accessibility features

## 📦 Commands

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
npm run test            # All tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e        # Production Docker + Playwright smoke tests
npm run test:e2e:headed # Smoke tests with a visible Chromium window
npm run test:soak:managed # Configurable multi-room load test
npm run test:soak:chaos # Load + backend/Redis/PostgreSQL fault injection
npm run test:ci         # Full CI pipeline (lint + type-check + tests)
npm run test:coverage   # Coverage report
```

### Database

```bash
npm run db:start        # Start PostgreSQL
npm run db:stop         # Stop PostgreSQL
npm run db:reset        # Reset database
npm run db:shell        # Open psql shell
```

### Assets

```bash
npm run organize-assets     # Organize asset files
npm run generate-assets     # Generate thumbnails and manifest
npm run optimize-images     # Optimize image files
```

### Docker

```bash
npm run docker:dev          # Development environment
npm run docker:dev:build    # Build and start dev
npm run docker:dev:down     # Stop dev environment
```

## 🧪 Testing Setup

- **Frameworks:** Vitest with Testing Library; Playwright for browser smoke tests
- **Mocks:** WebSocket, IndexedDB, localStorage, sessionStorage
- **Coverage:** 20% lines, 18% functions, 16% branches, 20% statements
- **Environment:** jsdom with custom setup

### Test Categories

- **Unit Tests:** Component and utility tests
- **Integration Tests:** Database operations and API endpoints
- **End-to-End Tests:** Production containers, two isolated clients, replica
  convergence, abrupt `SIGKILL` recovery after an ACK, PWA offline reloads,
  WebSocket reconnection, and dice runtime assets
- **Load/Soak Tests:** 50-100 rooms with 4-8 isolated clients each, mixed
  chat/dice/scene/token/state traffic, identity-preserving reconnects,
  cross-replica conflict probes, zero-loss/duplicate checks, and final hash
  convergence. The managed chaos mode restarts both backends, interrupts Redis,
  and injects PostgreSQL latency through Toxiproxy.

## 🛡️ Security

### Authentication

- OAuth2 authentication with Google and Discord
- JWT-based session management
- Secure token handling with environment variables

### Protection

- Helmet security headers
- Input validation and sanitization
- CORS configuration
- Environment variable management

### Best Practices

- Prepared statements for database queries
- Rate limiting on API endpoints
- Secure server-side session storage with PostgreSQL
- Redis is restricted to ephemeral realtime coordination
- Regular security scanning

## 🏢 Deployment

### Development

```bash
npm run start:all  # Local development with Docker
```

### Production (Docker Swarm)

```bash
docker stack deploy -c docker/docker-compose.yml nexus
```

### Configuration

Copy `.env.example` to `.env` and fill in the values before starting. The full reference is in that file; the table below covers the variables you must set for a production deployment.

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

#### Optional / deployment variables

| Variable         | Default                     | Description                                                                                                                                                                                             |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SECURE_COOKIES` | `true` (production)         | Set to `false` only in non-TLS local environments. Controls the `Secure` flag on session cookies. **Note:** `FORCE_HTTPS` no longer exists — it was removed as it only accidentally disabled this flag. |
| `IMAGE_PREFIX`   | `ghcr.io/joelmale/nexusvtt` | Container registry prefix used by docker-compose                                                                                                                                                        |
| `VERSION`        | `latest`                    | Image tag to deploy. CI automatically pushes `latest` and a date+SHA tag on every master merge. Pin to a specific tag (e.g. `20260611-63d0651`) for reproducible deploys.                               |
| `POSTGRES_USER`  | `nexus`                     | Postgres username                                                                                                                                                                                       |
| `POSTGRES_DB`    | `nexus`                     | Postgres database name                                                                                                                                                                                  |
| `CORS_ORIGIN`    | `http://localhost:5173`     | Comma-separated list of allowed CORS origins                                                                                                                                                            |

#### Proxy / SSL notes

nginx only terminates HTTP internally (port 80). TLS is terminated by the outer reverse proxy (Traefik, Cloudflare, etc.), which must forward `X-Forwarded-Proto: https` — nginx passes this through unchanged to the backend. The backend is configured with `trust proxy: 1` so `req.protocol` and session cookie security are derived from that header, not the internal connection.

### Infrastructure

- Multi-replica services for high availability
- Load balancing with VIP endpoint mode
- Automatic failover and recovery
- Container health monitoring

For an existing database, apply all three July 19 migrations before rolling the
new backend replicas: the ordered event journal, durable game-state commits,
then `server/migrations/2026-07-19-add-room-entity-versions.sql`. The last table
makes token/prop version checks atomic across replicas. New databases receive
the same objects from `server/schema.sql`.

The backend exposes a Prometheus endpoint at `/metrics` and a structured SLO
snapshot at `/api/metrics/multiplayer`. Start the optional Prometheus/Grafana
overlay with:

```bash
docker compose -f docker/docker-compose.yml \
  -f docker/docker-compose.observability.yml up -d
```

See [Multiplayer Reliability Operations](./docs/operations/multiplayer-observability.md)
for SLOs, alerts, OpenTelemetry export, load profiles, and the staging runbook.

## 📚 Documentation

### Architecture

- [Complete Architecture Guide](./docs/architecture.md)
- [Network and Session Architecture](./docs/network-and-sessions.md)
- [Ordered Event Delivery](./docs/ordered-event-delivery.md)
- [Delta-Sync Operations](./docs/delta-sync-rollout.md)
- [Multiplayer Reliability Operations](./docs/operations/multiplayer-observability.md)

### Deployment

- [Production Deployment Guide](./docs/HOMELAB_DEPLOYMENT.md)
- [Deployment Quick Reference](./docs/DEPLOYMENT_QUICKREF.md)

### Development

- [Developer Setup Guide](./docs/developer/development.md)
- [Testing Guidelines](./docs/developer/testing.md)
- [Dependency Policy](./docs/dependency-policy.md)

### Assets

- [Asset Management Guide](./docs/ASSETS-GUIDE.md)
- [Asset Processing](./docs/assets/processing.md)

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create feature branch from `main`
3. Make changes with tests
4. Run lint and type-check
5. Submit pull request

### Requirements

- All changes must include tests
- Code must pass lint and type-check
- Coverage thresholds must be met
- Documentation must be updated

### Guidelines

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## 📋 License

MIT - see [LICENSE](./LICENSE).

## 🚀 Getting Started

### Prerequisites

- Node.js 26.5.0+
- npm 11.0.0+
- Docker Desktop
- PostgreSQL client (optional)

### First-Time Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development environment: `npm run start:all`
4. Access frontend at http://localhost:5173
5. Create account via OAuth or email

### Development Tips

- Use `npm run dev` for frontend-only development
- Use `npm run server:dev` for backend-only development
- Use `npm run docker:dev` for full Docker development
- Check logs with `npm run db:logs` for database issues

### Common Issues

- Port conflicts: Use `npm run start:all` for automatic resolution
- Database connection: Verify Docker is running
- Build errors: Check TypeScript configuration
- Testing issues: Verify test setup and mocks

## 📊 Project Status

### Current Version: 0.1.0

- **Status:** Active Development
- **Last Update:** February 2026
- **Contributors:** 5+
- **License:** MIT

### Roadmap

- Enhanced real-time collaboration features
- Advanced analytics dashboard
- Mobile app development
- AI-powered game master assistance
- Virtual reality support

### Contributing

We welcome contributions! See our [contributing guidelines](./CONTRIBUTING.md) for details.

## 📞 Support

### Issues

Report bugs and request features at: https://github.com/your-org/nexus-vtt/issues

### Documentation

- API Documentation: [api-docs.md](./docs/api-docs.md)
- Architecture Decisions: [adr.md](./docs/adr.md)
- Deployment Guides: [deployment-guides](./docs/)

### Community

- Discord Server: [discord.gg/nexus-vtt](https://discord.gg/nexus-vtt)
- GitHub Discussions: [discussions](https://github.com/your-org/nexus-vtt/discussions)

---

**Built with ❤️ using modern web technologies.**

_Last updated: February 2026_
