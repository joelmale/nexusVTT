# SV-2: Systems Resource Flow Description

This system resource flow model describes how resources move between runtime
systems in the Nexus VTT deployment.

## System Resource Flow

```mermaid
sequenceDiagram
  participant B as Browser System
  participant F as Frontend System
  participant A as Backend System
  participant P as PostgreSQL System
  participant R as Redis System
  participant O as OAuth Provider
  participant D as NexusCodex System

  B->>F: GET /
  F-->>B: index.html, JS, CSS
  B->>F: POST /auth/login or GET /auth/google
  F->>A: proxy /auth/*
  A->>P: user/session SQL
  A-->>O: OAuth2 calls when used
  A-->>F: JSON or redirect + Set-Cookie
  F-->>B: response + cookie
  B->>F: GET /api/campaigns
  F->>A: proxy /api/campaigns
  A->>P: SELECT campaigns
  A-->>F: JSON
  F-->>B: JSON
  B->>F: WSS /ws?host=CODE&campaignId=...
  F->>A: HTTP upgrade /ws
  A->>P: create/activate session
  B->>A: state snapshot or content-hash patch
  A->>P: CAS snapshot + token + version
  P-->>A: committed version or conflict tuple
  A-->>B: durable ACK or authoritative resync
  A-->>R: publish committed traffic and renew presence/lease
  R-->>A: fanout from other backend replicas
  A-->>D: optional document proxy calls
```

## Resource Flow Matrix

| Producer system | Consumer system      | Resource                                                                                         | Protocol/path                    |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------- |
| Browser         | Frontend             | SPA and static asset requests                                                                    | HTTP(S) `/`, `/assets/*`         |
| Frontend        | Browser              | Built HTML, JS, CSS, fonts, image assets                                                         | HTTP(S) response                 |
| Browser         | Backend via Frontend | Auth, user, campaign, character, token, document API requests                                    | HTTP(S) JSON `/api/*`, `/auth/*` |
| Backend         | Browser via Frontend | JSON responses, redirects, cookies                                                               | HTTP(S), `Set-Cookie`            |
| Browser         | Backend via Frontend | Realtime session actions                                                                         | WebSocket `/ws` JSON             |
| Backend         | Browser              | Events, durable ACKs, JSON patches/resync snapshots, chat, dice results, errors, heartbeat pings | WebSocket JSON                   |
| Backend         | PostgreSQL           | SQL queries, canonical snapshot CAS, ordered event transactions                                  | PostgreSQL TCP :5432             |
| PostgreSQL      | Backend              | Rows and JSONB values                                                                            | PostgreSQL TCP :5432             |
| Backend         | Redis                | Versioned pub/sub, presence, host leases, readiness                                              | Redis TCP :6379                  |
| Backend         | OAuth providers      | OAuth redirects/token/profile interactions                                                       | HTTPS                            |
| Backend         | NexusCodex           | Document CRUD/search/content metadata                                                            | HTTP JSON, optional              |
