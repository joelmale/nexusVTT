# 🎲 Nexus VTT

**Modern virtual tabletop with real-time multiplayer, OAuth authentication, and PWA capabilities.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

## 🚀 Quick Start

```bash
npm install
npm run start:all  # Starts PostgreSQL, Redis, and both services
```

**Access:**

- Frontend: http://localhost:5173
- Backend: http://localhost:5001
- Database: http://localhost:5432

## 🏗️ Architecture

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Express.js + WebSocket + PostgreSQL + Redis
- **State Management:** Zustand with immer + IndexedDB persistence
- **Authentication:** OAuth2 (Google/Discord) + JWT sessions
- **Deployment:** Docker Swarm + Nginx Proxy Manager

## ✨ Features

### 🔄 Real-time Multiplayer

- Host and player roles with synchronized sessions
- Real-time dice rolling and game state updates
- WebSocket communication for instant updates
- Session persistence across browser refreshes

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

- **Framework:** Vitest with Testing Library
- **Mocks:** WebSocket, IndexedDB, localStorage, sessionStorage
- **Coverage:** 20% lines, 18% functions, 16% branches, 20% statements
- **Environment:** jsdom with custom setup

### Test Categories

- **Unit Tests:** Component and utility tests
- **Integration Tests:** Database operations and API endpoints
- **End-to-End Tests:** Full user workflows

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
- Secure session storage with Redis
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

- Environment variables in `.env`
- SSL certificates via Nginx Proxy Manager
- Health checks and monitoring
- NFS storage for data persistence

### Infrastructure

- Multi-replica services for high availability
- Load balancing with VIP endpoint mode
- Automatic failover and recovery
- Container health monitoring

## 📚 Documentation

### Architecture

- [Complete Architecture Guide](./docs/architecture.md)
- [Component Structure](./docs/component-structure.md)
- [State Management](./docs/state-management.md)

### Deployment

- [Production Deployment Guide](./docs/HOMELAB_DEPLOYMENT.md)
- [Docker Configuration](./docs/docker-setup.md)
- [SSL Certificate Setup](./docs/ssl-setup.md)

### Development

- [Developer Setup Guide](./docs/developer/development.md)
- [Code Style Guidelines](./docs/developer/code-style.md)
- [Testing Guidelines](./docs/developer/testing.md)

### Assets

- [Asset Management Guide](./docs/ASSETS-GUIDE.md)
- [Custom Asset Creation](./docs/developer/asset-creation.md)
- [Optimization Techniques](./docs/developer/asset-optimization.md)

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

- Node.js 20.19.0+
- npm 10.0.0+
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
