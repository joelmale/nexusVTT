# Nexus VTT Extended README

This document holds the longer-form project details that were removed from the
top-level `README.md`.

## Usage

### Creating a Game

1. Enter your name in the lobby.
2. Host a game to receive a room code.
3. Share the room code with players.

### Joining a Game

1. Enter your name in the lobby.
2. Enter the room code from the DM.
3. Join the session.

### Current Features

- Session management with room codes
- Multi-tab interface (Lobby, Dice, Scenes, Settings)
- Real-time dice roller with shared results
- Scene editor (backgrounds, grid, basic management)
- Asset browser with search and caching
- Player presence and management
- Themeable glassmorphism UI

## Project Structure

```
nexus-vtt/
├── src/                    # React frontend
│   ├── components/         # Lobby, DiceRoller, Layout, Settings, AssetBrowser
│   ├── stores/             # Zustand state
│   ├── types/              # TypeScript definitions
│   ├── utils/              # WebSocket service, dice utilities
│   └── styles/             # CSS styling
├── server/                 # WebSocket relay server
├── public/                 # Static assets
├── scripts/                # Dev and asset scripts
└── docs/                   # Documentation
```

## Asset Management

```bash
node scripts/process-assets.js /path/to/assets ./asset-server/assets
cd asset-server && npm run dev
```

Supported assets: maps, tokens, art, handouts, reference. Processing includes
WebP conversion, thumbnails, metadata extraction, and categorization.

## Development Scripts

```bash
npm run start:all
npm run dev
npm run server:dev
npm run build
npm run build:server
npm run build:all
npm run server:start
npm run preview
```

```bash
npm run type-check
npm run lint
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:ci
npm run test:watch
npm run test:coverage
```

```bash
npm run db:start
npm run db:stop
npm run db:down
npm run db:reset
npm run db:logs
npm run db:shell
```

```bash
npm run docker:dev
npm run docker:dev:build
npm run docker:dev:down
```

```bash
npm run generate-assets
npm run generate-thumbnails
npm run generate-default-manifest
npm run organize-assets
npm run update-assets
```

## Architecture Notes

- Client-first authority for game state.
- Server relays WebSocket events and persists sessions.
- Asset server provides optimized images and manifests.

## Roadmap (High Level)

- Tokens, initiative, combat, and status effects
- Drawing and measurement tools
- Fog of war and lighting
- Hex grid and gridless modes

## Test Suite and Security Notes

The repo includes unit, component, and e2e tests. For the NIST 800-53 test
mapping, see `docs/nist-test-mapping.md`.
