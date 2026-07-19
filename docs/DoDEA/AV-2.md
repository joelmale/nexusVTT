# AV-2: Integrated Dictionary

## Terms and Acronyms

| Term | Definition |
| --- | --- |
| Nexus VTT | The virtual tabletop application in this repository. |
| VTT | Virtual tabletop, a web application for running tabletop RPG sessions. |
| Campaign | Persistent collection owned by a DM/host; stored in `campaigns` with JSONB `scenes`. |
| Session | Live or hibernated game instance tied to a campaign and join code; stored in `sessions`. |
| Room | In-memory backend coordination object keyed by room/join code; tracks host, players, connections, state version, and game state. |
| Join code | Short code used by players to join a live session; stored as `sessions.joinCode`. |
| DM | Dungeon Master or primary host. Represented by `dmId`, `primaryHostId`, and host user roles. |
| Host | User with control authority for a live room; can transfer host or assign co-hosts. |
| Co-host | Additional host user for a session; persisted in `hosts` with permissions. |
| Player | Session participant with optional linked character; persisted in `players`. |
| Character | Player character record owned by a user; stored in `characters.data` as JSONB. |
| Scene | Game map/encounter canvas state including background, grid, lighting, drawings, tokens, props, and visibility. |
| Token | Placed creature/player/NPC representation on a scene. |
| Prop | Placed environmental object on a scene, optionally interactive. |
| Drawing | Scene annotation or measurement object such as line, rectangle, fog, spell template, or ping. |
| Asset manifest | JSON catalog of asset metadata with categories, thumbnails, dimensions, and file paths. |
| NexusCodex | Optional external document microservice suite accessed through backend proxy routes. |
| Document | NexusCodex metadata object for rulebooks, notes, handouts, maps, character sheets, or homebrew. |
| JSON Patch | RFC-style patch operation array used for `game-state-patch` WebSocket messages via `fast-json-patch`. |
| PWA | Progressive Web App; configured with `vite-plugin-pwa` and Workbox caching. |
| SPA | Single-page application served by Nginx with `/index.html` fallback. |
| Zustand | Frontend state management library used for game, character, document, initiative, and token stores. |
| IndexedDB | Browser storage used for maps, game state, local-first persistence, token images, and recovery. |
| `homelab-net` | External Docker Swarm network used by production services. |
| `DATABASE_URL` | Backend PostgreSQL connection string. |
| `REDIS_URL` | Redis connection used for cross-replica fanout, expiring presence, and host leases. |
| `DOC_API_URL` | Backend URL for optional NexusCodex document API integration. |
| `ASSETS_PATH` | Backend filesystem path for static asset catalog and uploaded custom tokens. |

## Naming Conventions

| Convention | Examples |
| --- | --- |
| React components in PascalCase | `Dashboard`, `GameUI`, `DocumentLibrary`, `TokenPanel` |
| Component files generally PascalCase or feature directories | `src/components/Dashboard.tsx`, `src/components/Tokens/TokenPanel.tsx` |
| Hooks with `use` prefix | `useUserProfile`, `useSessionPersistence`, `useDeviceDetection` |
| Zustand stores by domain | `gameStore`, `characterStore`, `documentStore`, `initiativeStore`, `tokenStore` |
| WebSocket event names as slash-delimited domains | `scene/create`, `token/move`, `dice/roll`, `session/host-changed` |
| Database identifiers use UUID primary keys | `users.id`, `campaigns.id`, `characters.id`, `sessions.id` |
| API routes grouped by domain | `/auth/*`, `/api/users/*`, `/api/campaigns`, `/api/characters`, `/api/documents` |

