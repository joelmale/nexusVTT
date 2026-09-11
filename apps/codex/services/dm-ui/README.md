# NexusCodex DM Campaign Planner

A client-side first, offline-capable campaign planning interface for D&D/TTRPG Dungeon Masters.

## Features

- 📱 **100% Offline Capable** - All campaign data stored client-side in IndexedDB
- 📦 **Portable Exports** - Export entire campaigns as JSON files for backup/sharing
- 📚 **Codex Integration** - Browse and link to SRD documents from the NexusCodex library
- 🎨 **Modern UI** - Built with React 18, TailwindCSS, and shadcn/ui components
- 🌙 **Dark Mode** - Full dark mode support with CSS variables
- 🔄 **Real-time Updates** - Live IndexedDB queries with Dexie.js
- 🎭 **Complete Campaign Tools**:
  - Campaign management
  - World builder with hierarchical locations
  - Session planner and runner
  - Plot thread tracker
  - NPC manager with relationships
  - Encounter builder
  - Rich note-taking system
  - Journals and lore encyclopedia

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 7 (requires Node.js 22+)
- **Styling**: TailwindCSS + shadcn/ui
- **Client Storage**: Dexie.js (IndexedDB wrapper)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (for codex browsing)
- **Rich Text Editor**: Lexical
- **Routing**: React Router v6

## Getting Started

### Prerequisites

- Node.js 22+ (required for Vite 7)
- Docker and Docker Compose (for running with the full stack)

### Development (Standalone)

```bash
# Install dependencies
npm install

# Start dev server (runs on port 3003)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development (Docker Compose)

The DM UI is integrated into the NexusCodex stack:

```bash
# From the root of NexusCodex repository
docker compose up dm-ui

# Or start the entire stack
docker compose up
```

**Access the DM UI**: http://localhost:3003

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# API Endpoints
VITE_DOC_API_URL=http://localhost:3005
VITE_WEBSOCKET_URL=ws://localhost:3002
```

These environment variables are automatically set when running via Docker Compose.

## Architecture

### Client-Side First Design

The DM UI is designed to work **100% offline** with zero backend dependencies for campaign planning:

1. **IndexedDB Storage** - All campaign data stored locally using Dexie.js
2. **Read-Only Codex Access** - Browse documents from doc-api (optional)
3. **Portable JSON Exports** - Export/import campaigns as JSON files
4. **No Authentication Required** - Single-user, local storage only

### Database Schema (IndexedDB)

The app uses 12 IndexedDB tables:

- `campaigns` - Campaign metadata
- `worlds` - Hierarchical world/location structure
- `sessions` - Session planning and notes
- `plotThreads` - Story plots and sub-plots
- `clues` - Plot clues with discovery tracking
- `npcs` - NPC database with relationships
- `encounters` - Combat/social/exploration encounters
- `notes` - General note-taking with entity linking
- `journals` - Personal journals with entries
- `journalEntries` - Individual journal entries
- `loreEntries` - World lore encyclopedia
- `codexLinks` - Links between campaign entities and codex documents

All tables have automatic timestamp tracking (createdAt, updatedAt).

## Project Structure

```
services/dm-ui/
├── src/
│   ├── components/        # React components
│   │   └── layout/        # App layout, navbar, sidebar
│   ├── db/                # IndexedDB schema (Dexie.js)
│   ├── hooks/             # Custom React hooks (TODO)
│   ├── lib/               # Utility functions
│   ├── pages/             # Route pages
│   ├── services/          # Business logic (export, search, etc.) (TODO)
│   ├── stores/            # Zustand state stores
│   ├── styles/            # Global CSS
│   ├── types/             # TypeScript types (TODO)
│   ├── App.tsx            # Root component with routing
│   └── main.tsx           # App entry point
├── Dockerfile             # Multi-stage Docker build
├── nginx.conf             # Nginx config for SPA routing
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # TailwindCSS config
└── package.json           # Dependencies
```

## Features & Roadmap

### ✅ Phase 1: Foundation (Current)

- [x] Project setup (Vite, React, TypeScript, TailwindCSS)
- [x] IndexedDB schema with Dexie.js (12 entity types)
- [x] Base UI layout (navbar, sidebar, routing)
- [x] Campaign list page with live queries
- [x] Docker integration
- [ ] Campaign CRUD (create, edit, delete)
- [ ] Codex browser (browse doc-api documents)
- [ ] Export/Import system (JSON)

### 🚧 Phase 2: World Building & Sessions

- [ ] Hierarchical world builder
- [ ] Map upload and viewer
- [ ] Session planner with calendar
- [ ] Rich text editor for session notes
- [ ] Session runner (in-progress session view)

### 📅 Phase 3: Story Tools

- [ ] Plot thread tracker with visualizations
- [ ] NPC manager with relationship graphs
- [ ] Encounter builder with codex integration
- [ ] D&D 5e difficulty calculator

### 📅 Phase 4: Notes & Journals

- [ ] Rich note-taking with entity linking
- [ ] Journal system with timeline view
- [ ] Lore encyclopedia with categories

### 📅 Phase 5: AI Tools (DEFERRED)

- [ ] Quest generator (TODO - API costs)
- [ ] NPC personality generator (TODO - API costs)
- [ ] Description enhancer (TODO - API costs)
- [ ] Session recap generator (TODO - API costs)

### 📅 Phase 6: Polish & Advanced Features

- [ ] Global search (client-side with Fuse.js)
- [ ] Command palette (Cmd+K shortcuts)
- [ ] Campaign dashboard with analytics
- [ ] Full dark mode support
- [ ] Mobile optimization
- [ ] Auto-backup system

## Export/Import Format

Campaigns can be exported as portable JSON files with the following structure:

```json
{
  "version": "1.0.0",
  "exportedAt": 1703145600000,
  "exportedBy": "offline",
  "campaign": { /* Campaign object */ },
  "worlds": [ /* Array of worlds */ ],
  "sessions": [ /* Array of sessions */ ],
  "plotThreads": [ /* Array of plots */ ],
  "npcs": [ /* Array of NPCs */ ],
  /* ... other entities ... */
  "metadata": {
    "totalNotes": 42,
    "totalSessions": 10,
    "totalNPCs": 25
  }
}
```

## Codex Integration

The DM UI can browse and link to documents from the NexusCodex library:

- **Read-Only Access** - Browse SRD spells, monsters, items, etc.
- **Entity Linking** - Link codex documents to NPCs, encounters, notes
- **Offline Caching** - Document metadata cached in IndexedDB
- **Search Integration** - Uses existing doc-api search endpoints

## Development Tips

### IndexedDB DevTools

Use browser DevTools to inspect IndexedDB:

- **Chrome**: DevTools > Application > Storage > IndexedDB > NexusCodexCampaigns
- **Firefox**: DevTools > Storage > IndexedDB > NexusCodexCampaigns

### Live Queries with Dexie

The app uses `useLiveQuery` from dexie-react-hooks for reactive database queries:

```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';

const campaigns = useLiveQuery(() =>
  db.campaigns.where('status').notEqual('archived').toArray()
);
```

### Hot Module Replacement (HMR)

Vite provides fast HMR during development. Changes to React components will reload instantly without losing app state.

## Deployment

### Production Build

```bash
npm run build
```

This creates an optimized build in the `dist/` directory with:
- Code splitting for faster initial load
- Minified JavaScript and CSS
- Asset hashing for cache busting

### Docker Production Build

The Dockerfile uses a multi-stage build:

1. **Builder stage** - Installs dependencies and builds the app
2. **Production stage** - Serves built files with nginx

```bash
docker build -t nexuscodex-dm-ui .
docker run -p 3003:80 nexuscodex-dm-ui
```

## Browser Support

- **Recommended**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Required**: IndexedDB support (all modern browsers)
- **Optional**: WebSocket support (for future real-time features)

## Troubleshooting

### "Module not found" errors

Run `npm install` to ensure all dependencies are installed.

### IndexedDB quota exceeded

Clear browser data or export campaigns and delete old ones. Each campaign with extensive notes can use several MB.

### Vite dev server not starting

Ensure Node.js 22+ is installed (`node --version`). Vite 7 requires Node.js 22+.

### Port 3003 already in use

Change the port in `vite.config.ts`:

```typescript
server: {
  port: 3004 // or any available port
}
```

## Contributing

This is part of the NexusCodex project. See the main repository README for contribution guidelines.

## License

See the main NexusCodex repository for license information.

---

**Built with ❤️ for Dungeon Masters everywhere**
