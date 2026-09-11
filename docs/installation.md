# Installation Guide

This guide sets up Nexus VTT for local development.

## Prerequisites

- Node.js `26.5.0` or newer on the Node 26 line
- npm `11.0.0` or newer
- Docker Desktop or Docker Engine
- Git
- A modern browser

## Local Setup

Clone the repository:

```bash
git clone https://github.com/joelmale/nexusVTT.git
cd nexusVTT
```

Install dependencies:

```bash
npm install
```

Copy the sample environment if you need local overrides:

```bash
cp .env.example .env
```

For the default local database, use:

```env
DATABASE_URL=postgresql://nexus:password@localhost:5432/nexus
POSTGRES_DB=nexus
POSTGRES_USER=nexus
POSTGRES_PASSWORD=password
REDIS_PASSWORD=change-this-redis-password
```

Start PostgreSQL for development:

```bash
npm run db:start
```

Start the app stack:

```bash
npm run start:all
```

Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5001/health`
- Backend system health: `http://localhost:5001/api/system/health`

## Common Commands

```bash
npm run dev
npm run server:dev
npm run start:all
npm run type-check
npm run test
npm run test:ci
```

Database helpers:

```bash
npm run db:start
npm run db:stop
npm run db:reset
npm run db:logs
npm run db:shell
```

Asset helpers:

```bash
node scripts/process-assets.js /path/to/assets ./static-assets/assets
npm run generate-assets
npm run seed:library-assets
```

## Verification

1. Open `http://localhost:5173`.
2. Create a guest room.
3. Join from another browser profile.
4. Roll dice and move a token.
5. Confirm both clients stay in sync.

## Troubleshooting

If ports are busy, check the common development ports:

```bash
netstat -ano | findstr ":5173"
netstat -ano | findstr ":5001"
```

If the backend cannot connect to PostgreSQL, verify Docker is running and then
restart the dev database:

```bash
npm run db:reset
```

If assets do not appear, regenerate the local manifest:

```bash
npm run generate-assets
```

## Next Steps

- [Getting Started](getting-started.md)
- [First Game Setup](first-game.md)
- [Development Guide](developer/development.md)
- [Testing Guide](developer/testing.md)
- [Asset Processing](assets/processing.md)
- [Deployment Quick Reference](DEPLOYMENT_QUICKREF.md)
