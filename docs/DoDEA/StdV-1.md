# StdV-1: Standards Profile

## Programming Languages and Runtime Standards

| Standard/technology | Usage |
| --- | --- |
| TypeScript 5.9 strict mode | Frontend, backend, shared types |
| ECMAScript modules | `package.json` uses `"type": "module"` |
| Node.js 26.5 | Engine requires `>=26.5.0 <27`; CI and Docker use `node:26.5.0` |
| HTML5/CSS/DOM APIs | Browser UI, IndexedDB, Service Worker, WebSocket |
| SQL/PostgreSQL | Relational schema, JSONB, indexes, triggers |
| JSON | REST payloads, manifests, WebSocket payloads, document metadata |
| JSON Patch | State deltas with `fast-json-patch` |
| OAuth 2.0 | Google and Discord login flows |
| HTTP cookies | Express session cookie with `HttpOnly`, `SameSite=Lax`, production secure behavior |

## Application Frameworks and Libraries

| Area | Stack |
| --- | --- |
| Frontend UI | React 19, React DOM, React Router 7 |
| Build tooling | Vite 7, `@vitejs/plugin-react`, Rollup visualizer |
| PWA/offline | `vite-plugin-pwa`, Workbox |
| State | Zustand 5, Immer |
| 3D/graphics | Three.js, React Three Fiber, Drei, Cannon, Dice Box |
| Drag and drop | React DnD and HTML5 backend |
| PDF | `pdfjs-dist` |
| Notifications/icons | Sonner, Lucide React |
| Backend HTTP | Express 5, Helmet, CORS, Compression |
| WebSocket | `ws` |
| Auth/session | Passport, Google OAuth strategy, generic OAuth2 strategy, `express-session`, `connect-pg-simple`, JSON Web Token dependency |
| Database | `pg`, PostgreSQL UUID extension, JSONB |
| Images/assets | Sharp, asset generation scripts |
| Testing | Vitest, Testing Library, jsdom, fake-indexeddb |
| Lint/format | ESLint 9, typescript-eslint, Prettier |

## Container and Infrastructure Standards

| Standard/technology | Usage |
| --- | --- |
| Docker multi-stage builds | Frontend build and Nginx runtime image |
| Docker Compose v3.8 | Production, development, and test topology definitions |
| Docker Swarm | Production deploy target with replicas, placement constraints, health checks, VIP endpoint mode |
| Nginx | Static SPA delivery and reverse proxy for API/auth/WebSocket |
| Alpine Linux images | Node, Nginx, PostgreSQL, Redis base images |
| NFS-backed persistence | Production PostgreSQL and Redis data mounts |
| Health checks | Nginx `/health`, backend `/health`, PostgreSQL `pg_isready`, Redis `redis-cli` |
| External overlay network | `homelab-net` for production service discovery |

## Security and Interoperability Standards

| Standard or practice | Repository implementation |
| --- | --- |
| Security headers | Nginx headers plus Express Helmet |
| CORS | Express CORS with environment-configured origins and credentials |
| Password hashing | PBKDF2 SHA-512, random salt, 120000 iterations by default |
| SQL safety | Backend uses `pg` parameterized queries for database operations |
| Session persistence | PostgreSQL-backed server sessions through `connect-pg-simple` |
| OAuth callback enforcement | Production OAuth callback URLs must be absolute HTTPS URLs |
| Non-root backend container | Backend Dockerfile creates and runs as `nodejs` user |
| Asset caching | Nginx cache headers and Workbox runtime caches |

## Compliance Notes and Gaps

| Observation | Architectural significance |
| --- | --- |
| Redis carries ephemeral pub/sub, presence, and host leases; Express sessions remain in PostgreSQL | Preserve this separation so Redis loss cannot erase authenticated sessions or ordered history. |
| Backend replicas maintain local WebSocket connections in memory | Redis fanout plus PostgreSQL journal catch-up provides cross-replica delivery without room-sticky routing. |
| Node 26 is the Current release line rather than LTS | Track Node's release lifecycle and plan an explicit move to an LTS line if production stability takes precedence over early access to platform features. |
| Production Compose lacks `ports:` on frontend | Public ingress must be supplied externally by Swarm routing mesh/reverse proxy attachment. |
| Optional document routes are mounted even when disabled | Disabled mode returns `503` for document operations and `{ status: "disabled" }` for document health. |
