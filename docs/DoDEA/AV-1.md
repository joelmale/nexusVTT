# AV-1: Executive Summary

Nexus VTT is a browser-based virtual tabletop application for tabletop RPG
sessions. It provides campaign and character management, real-time host/player
game sessions, scene editing, map/token/prop placement, drawing tools, chat,
server-authoritative dice rolls, document-library integration, OAuth/local/guest
authentication, and progressive web app behavior.

The operational architecture is a multi-container web application:

| Capability | Architectural implementation |
| --- | --- |
| Browser client | React 19, TypeScript, Vite, PWA service worker, Zustand stores, IndexedDB/localStorage persistence |
| Static delivery and edge routing | Nginx frontend container serves the SPA and proxies `/api`, `/auth`, and `/ws` |
| Runtime services | Express 5 backend with REST APIs, Passport authentication, PostgreSQL sessions, WebSocket room coordination, JSON Patch state deltas |
| Persistent storage | PostgreSQL stores users, campaigns, characters, game sessions, players, hosts, and Express session records |
| Cache/pub-sub infrastructure | Redis container is provisioned in production Compose, but repository code currently shows no Redis client integration beyond startup readiness and `REDIS_URL` configuration |
| Optional document capability | Backend can proxy to external NexusCodex document services when `DOC_API_URL` is set |
| Deployment target | Docker Swarm on an external `homelab-net` network, with NFS-mounted PostgreSQL and Redis data directories |

## Scope

| In scope | Out of scope or external |
| --- | --- |
| Browser UI, game session state, scene editing, authentication, campaign/character APIs, asset APIs, WebSocket coordination | External reverse proxy/TLS termination, OAuth provider infrastructure, NexusCodex implementation internals, production registry/CI publication |

## High-Level Capabilities

| Capability | Description |
| --- | --- |
| Real-time play | Host and player roles coordinate over WebSocket rooms using event messages, patches, chat, and heartbeats. |
| Campaign management | Authenticated users can create and update campaigns persisted in PostgreSQL. |
| Character management | Authenticated users can create, import, update, deduplicate, and delete character records. |
| Scene and board operations | Scenes contain grid settings, lighting, drawings, placed tokens, and placed props. |
| Asset management | Asset manifests, categories, search, static assets, and custom token uploads support game content. |
| Authentication | Local email/password, Google OAuth, Discord OAuth, and guest sessions are supported. |
| Document integration | Optional proxy routes expose NexusCodex document CRUD/search/content URL functions. |
| Local-first recovery | IndexedDB, localStorage, and PWA caches support browser-side recovery and offline-adjacent behavior. |

## Constraints and Assumptions

| Constraint or assumption | Impact |
| --- | --- |
| Production `docker-compose.yml` defines 2 frontend replicas and 3 backend replicas but no published ports | An external reverse proxy or Docker Swarm ingress is assumed to route public HTTPS traffic to the frontend service. |
| Backend maintains active rooms, connections, and room game state in process memory | Multi-replica WebSocket operation requires sticky routing by room/session or a shared coordination layer. Redis is present in Compose but not wired into backend pub/sub in the inspected code. |
| PostgreSQL is the canonical server data store | Server-side campaign, character, user, session, player, host, and Express session data persist across restarts. |
| Browser IndexedDB/localStorage retains local-first state | Some state exists client-side for responsiveness and recovery, so reconciliation with server state matters. |
| `DOC_API_URL` is optional | Document APIs return disabled/unavailable responses when NexusCodex services are not configured. |
| Swarm production uses prebuilt images | `docker stack deploy` ignores `build:` sections; image publication through CI/registry is assumed. |
| Existing `docs/architecture.md` contains older "no database" statements | Current code and schema supersede that older architecture note. |

