# SvcV-2: Services Resource Flow Description

This service resource flow model describes service-to-service exchanges and
consumer/provider relationships.

## Service Resource Flow

```mermaid
flowchart LR
  spaConsumer[Browser SPA]
  spaService[SPA Delivery Service]
  apiService[Application API Service]
  authService[Authentication Service]
  wsService[Realtime Collaboration Service]
  assetService[Asset Catalog Service]
  persistence[Persistence Service]
  redis[Redis Service]
  oauth[OAuth Services]
  docProxy[Document Proxy Service]

  spaConsumer -->|GET static files| spaService
  spaConsumer -->|REST JSON| apiService
  spaConsumer -->|WS JSON| wsService
  apiService -->|profile/session operations| authService
  apiService -->|asset lookup/upload| assetService
  apiService -->|SQL and JSONB| persistence
  wsService -->|session/player/state persistence| persistence
  apiService -. readiness dependency .-> redis
  authService -->|OAuth2| oauth
  apiService -. document CRUD/search .-> docProxy
```

## Service Flow Matrix

| Consuming service | Providing service | Resource flow | Service interface |
| --- | --- | --- | --- |
| Browser SPA | SPA Delivery Service | Application shell and bundled assets | HTTP GET |
| Browser SPA | Application API Service | Account, campaign, character, token, document, asset requests | JSON REST |
| Browser SPA | Realtime Collaboration Service | Game events, patches, chat, dice, heartbeat | WebSocket JSON |
| Application API Service | Authentication Service | User identity, session state, OAuth callback handling | Express middleware/routes |
| Application API Service | Asset Catalog Service | Manifest search, category lookup, token uploads | HTTP/static/file I/O |
| Application API Service | Persistence Service | Users, campaigns, characters, sessions, hosts, players | SQL |
| Realtime Collaboration Service | Persistence Service | Live session activation, player presence, saved game state | SQL |
| Authentication Service | OAuth Services | Authorization and profile data | OAuth2 HTTPS |
| Application API Service | Document Proxy Service | Document metadata, upload URLs, content URLs, search results | HTTP JSON |
| Backend startup | Redis Service | Availability gate | Redis PING |

