# StdV-1: Standards Profile

## Programming Languages and Runtime Standards

| Standard/technology | Usage |
| --- | --- |
| TypeScript 5.9 strict mode | Frontend, backend, shared types |
| ECMAScript modules | `package.json` uses `"type": "module"` |
| Node.js | Engine requires `>=20.19.0`; Dockerfiles currently use `node:25-alpine` |
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
| Redis is declared for sessions/pub-sub, but Express sessions are stored in PostgreSQL and no Redis client usage was found | Treat Redis as provisioned but not functionally integrated until pub/sub/session code is added. |
| Backend replicas maintain active WebSocket rooms in memory | Horizontal scaling depends on sticky routing or shared room state/pub-sub. |
| Frontend Dockerfile uses Node 25 while `package.json` declares Node `>=20.19.0` | This is compatible by version range, but production runtime reproducibility may improve with a pinned LTS image. |
| Production Compose lacks `ports:` on frontend | Public ingress must be supplied externally by Swarm routing mesh/reverse proxy attachment. |
| Optional document routes are mounted even when disabled | Disabled mode returns `503` for document operations and `{ status: "disabled" }` for document health. |
