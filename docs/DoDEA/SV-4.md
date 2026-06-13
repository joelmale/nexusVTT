# SV-4: Systems Functionality Description

This systems functionality model summarizes the functions performed by each
runtime system and maps those functions to data flows.

## System Functions

| System | Core functions | Consumes | Produces |
| --- | --- | --- | --- |
| Browser System | Render VTT UI, manage local game state, create scene/token/drawing/chat/dice actions, cache PWA assets, persist local maps/state, recover sessions | Static SPA assets, REST JSON, WebSocket messages, IndexedDB/localStorage records | REST requests, WebSocket events, IndexedDB records, UI state |
| Frontend System | Serve built SPA, perform SPA fallback, apply security/cache headers, gzip static assets, proxy API/auth/WebSocket traffic | Browser HTTP/WS requests, built `dist` files | Static file responses, proxied backend requests |
| Backend System | Validate inputs, authenticate users, manage users/campaigns/characters/sessions, save custom token images, serve asset manifest/category/search, proxy documents, coordinate rooms, roll dice | REST JSON, WebSocket JSON, session cookies, files, PostgreSQL rows, NexusCodex JSON | REST JSON, `Set-Cookie`, database mutations, WebSocket events, custom token files |
| PostgreSQL System | Enforce relational constraints, persist JSONB data, store Express sessions, run triggers for `updatedAt` | SQL queries/mutations from backend | Rows, JSONB blobs, indexes, constraint errors |
| Redis System | Provide available Redis endpoint for declared cache/pub-sub role | Redis PING from backend startup command | Readiness response |
| OAuth Provider Systems | Authenticate users and provide profile data | Browser redirects and backend token/profile requests | Authorization callbacks and profile fields |
| NexusCodex System | Manage document metadata, search, signed content/upload URLs | Authenticated proxy requests from backend | Document metadata/search JSON and upload/content URLs |

## Function to Data Flow Mapping

| Function | Primary data consumed | Primary data produced | Owning system |
| --- | --- | --- | --- |
| User registration/login | Email/password or OAuth profile, session cookie | `users` row, Express session row, user JSON | Backend, PostgreSQL |
| Guest creation | Guest display name | `users` row with `guest` provider, session data | Backend, PostgreSQL |
| Campaign management | Campaign name, description, scenes JSON | `campaigns` row and scene JSONB | Backend, PostgreSQL |
| Character management | Character name and arbitrary character JSON | `characters` row | Backend, PostgreSQL |
| Room hosting/joining | Join code, campaign ID, user ID/name | In-memory `Room`, `sessions`, `players`, `hosts` rows, WebSocket lifecycle events | Backend |
| Game state sync | Client state update events | In-memory room `gameState`, JSON Patch messages, persisted `gameState`/campaign scenes | Backend, PostgreSQL |
| Dice rolling | Dice expression, roller identity, visibility flags | Server dice roll result event and optional chat message | Backend |
| Asset discovery | Manifest and category/search request | Asset metadata JSON, static binary file responses | Backend and Frontend |
| Custom token save | Base64 image payload and token metadata | PNG file under custom token assets path and token URL response | Backend filesystem |
| Document library | Document metadata/search/upload request | Proxied NexusCodex JSON, signed URL/content URL response | Backend, NexusCodex |
| Local-first persistence | Browser state and generated maps | IndexedDB object store records, service worker caches | Browser |

