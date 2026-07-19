# SvcV-1: Services Context Description

The services view identifies the service resources exposed by Nexus VTT and the
external services it consumes.

## Service Composition

```mermaid
flowchart LR
  client[Client Service Consumer<br/>Browser SPA]
  spa[SPA Delivery Service<br/>frontend/Nginx]
  api[Application API Service<br/>backend/Express]
  ws[Realtime Collaboration Service<br/>backend/ws]
  auth[Authentication Service<br/>backend/Passport]
  assets[Asset Catalog Service<br/>backend/static files]
  db[(Persistence Service<br/>PostgreSQL)]
  redis[(Redis Service<br/>provisioned)]
  docs[Document Proxy Service<br/>NexusCodex optional]
  oauth[External OAuth Services]

  client --> spa
  client --> api
  client --> ws
  api --> auth
  api --> assets
  api --> db
  ws --> db
  ws --> redis
  auth --> oauth
  api -. when DOC_API_URL set .-> docs
```

## Service Inventory

| Service                        | Provider                               | Consumers                     | Service contract                                                                                             |
| ------------------------------ | -------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| SPA Delivery Service           | Frontend Nginx                         | Browser                       | HTTP GET static assets and SPA fallback                                                                      |
| Application API Service        | Backend Express                        | Browser SPA                   | JSON REST under `/api/*`                                                                                     |
| Authentication Service         | Backend Express/Passport               | Browser SPA, OAuth providers  | `/auth/*`, cookie-backed sessions, OAuth callbacks                                                           |
| Realtime Collaboration Service | Backend WebSocket server               | Browser SPA                   | WebSocket JSON under `/ws`; durable canonical ACKs, patches, authoritative resync, and ordered replay        |
| Asset Catalog Service          | Backend Express/static file serving    | Browser SPA                   | `/manifest.json`, `/search`, `/category/:category`, `/asset/:id`, static paths                               |
| Persistence Service            | PostgreSQL                             | Backend                       | SQL schema, canonical snapshot compare-and-swap tuples, ordered journal, Express sessions, and JSONB records |
| Redis Coordination Service     | Redis container                        | Backend replicas              | Versioned fanout, expiring room presence, and host-lease fencing                                             |
| Document Proxy Service         | Backend routes plus NexusCodex doc-api | Browser SPA                   | `/api/documents*`, `/api/search*`, `/api/health`                                                             |
| OAuth Service                  | Google/Discord                         | Backend and browser redirects | OAuth2 authorization and profile exchange                                                                    |
