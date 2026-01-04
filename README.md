# 🎲 Nexus VTT

![Nexus VTT Banner](public/assets/images/nexus-banner.png)

A lightweight, modern virtual tabletop for web browsers.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)

## Highlights

- Real-time multiplayer sessions with host/player roles
- Scene editor with grids, tokens, props, and drawing tools
- Fast client-first architecture with minimal server relay
- Glassmorphism UI with themeable styling

## Quick Start

Prereqs: Node 18+, npm, Docker Desktop.

```bash
npm install
npm run start:all
```

Frontend: http://localhost:5173  
Backend: http://localhost:5001

## Routes

- `/lobby` - create/join
- `/lobby/game/:roomCode` - active session
- `/dashboard` - user dashboard

## Common Commands

```bash
npm run dev          # frontend only
npm run server:dev   # backend only
npm run build:all    # production builds
npm run test:ci      # lint + type-check + tests
```

## Docs

- Extended README: `dev-docs/README-extended.md`
- Contributing: `CONTRIBUTING.md`
- Deployment: `DEPLOYMENT.md`
- Routing: `docs/routing-architecture.md`

## License

MIT — see `LICENSE`.
