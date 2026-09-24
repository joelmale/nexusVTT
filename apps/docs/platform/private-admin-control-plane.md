---
title: Private admin control plane implementation plan
---

# Private admin control plane implementation plan

- Date: 2026-09-23
- Status: Phase 0 implemented and merged to `main`; homelab deployment in
  progress. Phases 1-6 not started.

## Outcome

Build a private Nexus administration surface for content authoring, asset
management, and application operations. The control plane must be reachable
only from the home LAN or the Firewalla WireGuard VPN, require an authenticated
platform administrator, and avoid exposing internal services through the public
`app.nexusvtt.com` ingress.

The target experience is one administrative console with separate modules for:

- rules content such as spells, items, monsters, classes, and features;
- document ingestion, processing, validation, and search;
- image assets such as maps, tokens, props, and generated derivatives;
- application health, database health, user load, queues, and alerts; and
- administrator and audit-log management.

The console is a shared control surface, not a merger of the underlying service
domains. Codex remains the rules and document owner, the asset service remains
the image-asset owner, the VTT backend remains the game/session owner, and
Prometheus/Grafana remain the telemetry system of record.

## Verified starting point

The current VTT `/admin` route is not a production admin system. It is a frozen,
browser-only editor for bundled TypeScript SRD data. It has no durable server
storage or production authorization and is intentionally excluded from
production builds. See [ADR-0005](/vtt/adr/admin-panel-frozen).

The repository already contains a more capable Codex Admin UI with document,
processing, validation, search, log, Elasticsearch, and health pages. However,
the current production gateway configuration serves `/codex-admin/` and proxies
`/api/admin/` directly to `doc-api`. The homelab configuration also sets
`AUTH_DISABLED=true` for `doc-api`. That is acceptable only while `doc-api`
remains inaccessible from untrusted clients; a browser-reachable proxy defeats
that boundary.

The current Codex structured-data API can list and delete extracted entities,
but it is not yet a complete authoring API. It lacks typed create/update,
revision, draft, publication, conflict, and rollback contracts.

The VTT already exposes useful health and multiplayer measurements, including
rooms, WebSocket connections, database pool state, commit latency, queue depth,
resyncs, and realtime coordination. Prometheus rules exist for the multiplayer
reliability objectives. Some Codex health-page measurements are placeholders
and must not be treated as production telemetry until they are instrumented.

## Architectural invariants

The implementation must preserve these constraints:

1. PostgreSQL remains authoritative for durable application state. Redis is
   coordination, presence, and queue infrastructure, not the source of truth.
2. `doc-api` remains private while `AUTH_DISABLED=true`. Browsers never connect
   directly to it, even from the LAN.
3. Static SPAs continue to be served by the unified frontend Nginx gateway. Do
   not add standalone Nginx containers for the admin, DM, or Forge UIs.
4. Codex remains the document and rules-content domain. It does not acquire
   image-asset semantics.
5. The asset service remains the map, token, prop, image, manifest, and
   derivative domain. Administrators do not edit the NAS filesystem directly.
6. The VTT backend remains the game, campaign, session, and multiplayer domain.
   The control plane must not become a second game-state writer.
7. Prometheus and Grafana remain the operational telemetry source. The admin UI
   may summarize and link to them, but must not build a competing metrics store.
8. D&D rules entities distinguish the 2014 and 2024 rulesets and use typed,
   runtime-validated contracts.
9. Published content is versioned and immutable. Draft edits never alter an
   active session without an explicit publication step.
10. Production changes to the Dockhand environment merge the existing raw
    `.env`; they never replace it wholesale.

## Non-goals

- Reviving or extending the frozen VTT `AdminPage` implementation.
- Exposing PostgreSQL, Redis, Prometheus, MinIO, Elasticsearch, `doc-api`, or the
  asset service directly to a browser.
- Combining VTT and Codex databases.
- Moving image assets into Codex or rules entities into the asset manifest.
- Providing arbitrary SQL, filesystem, container-shell, or secret access in the
  browser.
- Allowing edits to mutate historical published revisions in place.
- Replacing Grafana with custom chart components.

## Target topology

Use a separate private hostname and ingress policy, but keep static delivery in
the existing unified frontend gateway.

```text
home LAN or Firewalla WireGuard client
            |
            v
admin.internal.nexusvtt.com    LAN-only DNS answer; no public A/AAAA record
            |
            v
Nginx Proxy Manager (npm)      TLS (*.internal.nexusvtt.com, DNS-01)
  on HomePod :443              + access list: LAN and WireGuard subnets only
            |
            v
frontend Nginx :8081           separate private listener; admin SPA,
  (private server block)       /control-api and liveness only
            |
            v
control-api                    authentication, RBAC, CSRF, audit, aggregation
     |             |              |                 |
     v             v              v                 v
  doc-api      asset-service   VTT backend       Prometheus/Grafana
  internal       internal       internal APIs      internal only
```

The admin console is LAN-only. Remote administrators connect through the
Firewalla Gold WireGuard VPN, which places them in the WireGuard subnet; no
other remote path exists. There is no public DNS record, Cloudflare route, or
router port forward for the admin hostname.

The admin hostname is `admin.internal.nexusvtt.com`:

- **DNS:** a local DNS record on the Firewalla Gold pointing at HomePod
  (`192.168.100.20`). The Firewalla answers for both LAN and WireGuard
  clients. The public
  `nexusvtt.com` zone gets no A/AAAA record for it.
- **TLS:** a Let's Encrypt wildcard certificate for `*.internal.nexusvtt.com`,
  issued by Nginx Proxy Manager using the DNS-01 challenge against the
  Cloudflare zone. DNS-01 needs no inbound reachability, and the wildcard keeps
  individual admin hostnames out of public certificate-transparency logs. No
  private CA has to be installed on admin devices.

Network position is not an identity. The access list keeps the internet out,
but every device on the LAN or VPN, and every container on the shared
`homelab-net` Docker network, can reach the private listener without passing
through that list. Authentication and authorization therefore remain mandatory,
and nothing on the private listener may reach `doc-api` or any other internal
API until `control-api` authentication exists.

## Routing model

Create separate public and private Nginx server contexts. Do not rely on a
hidden link or frontend route guard.

Separate them by listener port, not only by `server_name`. Public traffic
(Cloudflare, or direct to the home IP through the Firewalla port forward) and
LAN traffic both arrive at the same Nginx Proxy Manager on `:443`, so a
Host-header split inside one frontend listener would leave the edge access list
as the only barrier against `Host: admin.internal.nexusvtt.com` from the
internet. Instead:

- the public proxy host `app.nexusvtt.com` targets `frontend:80`, whose server
  block contains no admin locations regardless of the Host header; and
- the private proxy host `admin.internal.nexusvtt.com` targets `frontend:8081`,
  a separate server block that serves only the admin surfaces below.

The frontend does not publish `8081` on the host.

| Route or capability                    | Public `app.nexusvtt.com`  | Private admin hostname                                 |
| -------------------------------------- | -------------------------- | ------------------------------------------------------ |
| VTT SPA, `/auth`, `/ws`, normal `/api` | Allowed                    | Not required                                           |
| Forge and approved player/DM surfaces  | Allowed                    | Not required                                           |
| `/codex-admin/`                        | Return 404 or 403          | Serve the admin SPA                                    |
| `/api/admin/`                          | Return 404 or 403          | Replace with `/control-api/*`                          |
| `/codex-api/` catch-all                | Remove from public ingress | Do not expose directly                                 |
| Bulk ingestion and reprocessing        | Deny direct public access  | Proxy through `control-api`                            |
| Prometheus, Grafana, database, Redis   | Never exposed              | Reach through internal links or approved private proxy |
| `doc-api`, asset-service write API     | Never exposed              | `control-api` calls them over Docker networks          |

The public vhost must use explicit locations for supported browser functions.
It must not contain a generic proxy that lets a path reach arbitrary `doc-api`
routes.

The private vhost should expose only:

- the compiled admin SPA;
- `/control-api/*`;
- an authenticated Grafana route or a link to a separately protected private
  Grafana hostname; and
- a minimal liveness endpoint that reveals no dependency or version detail.

## Authentication and authorization

### Identity

Access requires two independent layers:

1. **Network gate (who can connect).** The Firewalla Gold and a Nginx Proxy
   Manager access list admit only the home LAN and WireGuard subnets. This
   keeps the internet out but identifies no one, supports no roles, and cannot
   attribute an audit event to a person.
2. **Identity (who is acting).** The Nexus account system, extended with
   durable platform roles and a private admin login flow, authenticates each
   administrator and authorizes each request.

Decision (2026-09-23): use Nexus accounts rather than an identity-aware proxy.
The homelab runs no Authentik or Authelia, and operating one for a single
administrator costs more than it returns. Nexus already has accounts and Google
sign-in; requiring Google sign-in for admin login puts MFA at the Google
account. Revisit an identity-aware proxy if more services need single sign-on.

Do not use a Nginx Proxy Manager basic-auth access list as the identity layer.
A shared password gives no per-user audit, roles, revocation, or MFA. It is
acceptable only as an extra outer layer.

Add a normalized role relation instead of an email allowlist:

```text
user_roles
  user_id
  role                 platform_admin | content_editor | operator | auditor
  granted_by
  granted_at
  revoked_at
```

Use a one-time deployment/bootstrap command to grant the first
`platform_admin`. Do not add a default administrator, a hard-coded email, or an
environment variable containing a reusable admin password.

### Roles

Start with these roles:

| Role             | Permissions                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `platform_admin` | Full control, role grants, publication, destructive operations     |
| `content_editor` | Draft and validate rules/documents; cannot publish or manage roles |
| `operator`       | View operations, acknowledge alerts, retry approved jobs           |
| `auditor`        | Read-only content, operations, and audit history                   |

Every `control-api` handler declares its required permission. UI visibility is
for usability only; server-side authorization is authoritative.

### Session security

- Use secure, HTTP-only, same-site cookies scoped to the private hostname.
- Keep the player-facing VTT session cookie host-only (no `Domain`
  attribute, as today), so it is never sent to `*.internal.nexusvtt.com`, and
  cover that with a regression test.
- Protect state-changing requests with CSRF tokens and origin checks.
- Rotate the session after login and privilege changes.
- Set a shorter idle timeout than the player-facing VTT session.
- Require recent reauthentication for role changes, permanent deletion, index
  recreation, and publication rollback.
- Prefer MFA at the identity provider or private ingress.

## Control API

Add a dedicated `control-api` service rather than placing cross-domain admin
traffic in the multiplayer backend. This isolates administrative load and
prevents the game server from becoming a privileged general-purpose proxy.

The service should:

- authenticate the administrator and enforce role permissions;
- expose a narrow, versioned browser contract under `/control-api/v1`;
- call internal services using allowlisted clients and service credentials;
- normalize dependency errors without leaking secrets or internal addresses;
- add request IDs and structured logs;
- write audit records in the same transaction as control-plane mutations where
  practical; and
- use optimistic concurrency for all editable records.

Suggested route groups:

```text
/control-api/v1/me
/control-api/v1/rules/*
/control-api/v1/documents/*
/control-api/v1/assets/*
/control-api/v1/operations/*
/control-api/v1/audit/*
/control-api/v1/administrators/*
```

Do not implement an unrestricted URL proxy. Each route group should have a
typed client for its owning service and an explicit method allowlist.

## Audit contract

Every administrative mutation records:

- actor ID and authenticated identity provider;
- role used for authorization;
- action and resource type;
- resource ID and prior version;
- request ID, timestamp, and source address;
- a redacted before/after summary or content revision IDs; and
- success, rejection, or failure result.

Audit entries are append-only through the application. Sensitive document
content, passwords, tokens, cookies, and service secrets must not be copied into
the audit payload.

## Rules-content model

Create a canonical rules registry in the Codex domain. Keep imported source
documents and authored rules entities related but distinct: a source document
may produce candidate entities, while the published catalog contains reviewed,
stable records.

Suggested conceptual model:

```text
rules_entities
  id                    stable UUID
  entity_type           spell | item | monster | class | feature | ...
  slug                  stable human-readable identifier
  ruleset_revision      2014 | 2024
  schema_version
  current_revision_id
  created_at
  archived_at

rules_entity_revisions
  id
  entity_id
  revision_number
  status                draft | validated | published | superseded
  data                  validated JSON document
  source_document_id    optional provenance
  source_license
  created_by
  created_at
  published_by
  published_at
```

Use shared Zod schemas and generated TypeScript types for API validation. The
schema package should cover, at minimum:

- spells: level 0-9, school, casting time, range, components, material cost and
  consumption, duration, concentration, ritual, classes, description, and
  higher-level text;
- items: category, rarity, attunement, weapon/armor properties, damage or AC,
  charges, activation, and rules text;
- monsters: size, type, AC, HP formula, speeds, abilities, saves, skills,
  defenses, senses, languages, CR/XP, traits, actions, reactions, and legendary
  actions; and
- classes/species/backgrounds/features with explicit 2014/2024 semantics.

The schema belongs in one shared package consumed by Codex validation, the
admin forms, VTT catalog adapters, Forge, and `@nexus/character-creator` where
appropriate. Do not duplicate creator ownership or persistence inside the
character-creator package.

### Authoring workflow

1. Create or import a draft.
2. Validate shape, cross-references, uniqueness, and ruleset compatibility.
3. Preview the entity as the VTT/Forge will render it.
4. Review the change and provenance.
5. Publish an immutable revision.
6. Increment the catalog version and invalidate catalog caches.
7. Retain the prior published revision for rollback and historical sessions.

Use an `If-Match` revision or explicit expected-version field for updates.
Conflicting edits return `409 Conflict` with the current revision; the server
must not silently accept last-write-wins.

### Runtime consumption

Expose a read-only published catalog through the normal authenticated Nexus
backend, not directly from the private control plane. The VTT and Forge should:

- fetch a catalog manifest/version;
- cache published entities by stable ID and revision;
- overlay published custom content on the bundled SRD fallback;
- record the catalog revision used by persisted characters or campaigns when
  rules stability matters; and
- continue to operate with bundled SRD content if Codex is unavailable.

Publication must not rewrite an active session snapshot. Session adoption of a
new catalog revision should be explicit or occur only when a new campaign or
character is created, according to the owning feature's rules.

## Asset administration

Extend the asset service with internal admin endpoints called only by
`control-api`. Reuse the existing manifest, storage, and derivative pipeline.

The first asset-management release should support:

- browse, search, filter, preview, and provenance;
- upload with file-type, size, and image-decode validation;
- display-name, tags, category, attribution, and license edits;
- derivative regeneration and manifest rebuild;
- storage usage, orphan, missing-file, and hash-mismatch reports;
- soft deletion/quarantine followed by deliberate permanent deletion; and
- reference/usage warnings when the VTT can identify dependent campaigns.

All writes continue to require an internal service credential. The browser must
never receive `ASSET_SERVICE_SECRET`, NAS paths, or a writable MinIO endpoint.
Validate resolved paths beneath the configured asset roots before file moves or
deletion.

## Operations and observability

Grafana is the detailed operations workspace. The admin console should provide
a concise status page with links to the relevant dashboard and runbook.

### Required measurements

| Area           | Measurements                                                                     |
| -------------- | -------------------------------------------------------------------------------- |
| User load      | active rooms, WebSocket connections, authenticated sessions, joins/leaves        |
| HTTP           | request rate, errors, p50/p95/p99 latency, in-flight requests                    |
| Multiplayer    | commit latency/failures, queue depth, resyncs, event conflicts, Redis fanout     |
| PostgreSQL     | availability, pool use/waiters, connections, query latency, locks, database size |
| Redis          | availability, memory, command latency, evictions, queue depth                    |
| Codex          | document jobs, failures, OCR time, indexing state, search latency                |
| Assets         | object count, bytes, derivative failures, manifest age, missing files            |
| Infrastructure | container CPU/memory/restarts, host disk, volume capacity                        |

Add `postgres_exporter`, `redis_exporter`, and container/host metrics only on the
internal monitoring network. Instrument application counters and histograms at
their source rather than polling expensive aggregate queries on every dashboard
refresh.

Protect Prometheus with an internal network boundary and the existing metrics
token where applicable. Grafana must require its own authenticated session or
trusted identity-proxy assertion. Do not embed anonymous Grafana panels.

### Health semantics

- Liveness answers whether the process is running and must remain cheap.
- Readiness verifies dependencies required to serve traffic.
- Detailed dependency health is authenticated and private.
- Metrics report measurements; health endpoints report actionable state.
- A degraded optional dependency should not make unrelated VTT capabilities
  unavailable.

## Delivery plan

### Phase 0 - Contain the current public admin surface

Deliverables:

- Inventory every public Nginx route that can reach `doc-api` or an admin action.
- Deny `/codex-admin/` and `/api/admin/` on the public vhost.
- Remove the public generic `/codex-api/` proxy.
- Route-classify bulk upload, reprocessing, deduplication, queue, search, reader,
  annotations, and reference endpoints. Preserve only explicitly approved
  player/DM functions through an authenticated VTT BFF.
- Confirm no host port, public proxy, or untrusted Docker network reaches
  `doc-api` while `AUTH_DISABLED=true`.
- Set and verify `METRICS_AUTH_TOKEN`; ensure public `/metrics` is not proxied.
- Set production `DEV_MODE=false` after any intentional quick-start use.

Gate: an unauthenticated request through `app.nexusvtt.com` cannot load the
admin SPA or invoke an administrative mutation, while normal VTT document and
game workflows still pass.

#### Phase 0 status

Merged to `main` in `2de28f4a` (containment) and `4d1fd352` (CI docs-deploy
condition). CI built and promoted the `frontend`, `backend`, `asset-service`,
and `postgres` images. **Deployment to the `nexus-vtt2` Dockhand stack is in
progress** and is not complete until the checklist below is done.

Deliverable checklist:

| Deliverable                                                   | State                                                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Inventory public routes reaching `doc-api` or admin actions   | Done (route table below)                                                                 |
| Deny `/codex-admin/` and `/api/admin/` publicly               | Done in repository; pending deploy                                                       |
| Remove the public generic `/codex-api/` proxy                 | Done in repository; pending deploy                                                       |
| Route-classify ingestion, processing, and reader endpoints    | Done (route table below)                                                                 |
| No host port, public proxy, or untrusted network to `doc-api` | Done in repository; pending deploy                                                       |
| `METRICS_AUTH_TOKEN` set and verified                         | Compose now requires it; live value not yet set (was empty, so metrics were unprotected) |
| Production `DEV_MODE=false`                                   | Pending (live value was `true`)                                                          |
| Gate verified against `app.nexusvtt.com`                      | Pending deploy                                                                           |

Live state found on 2026-09-23 before deployment: `doc-api` (with
`AUTH_DISABLED=true`) was attached to the shared `homelab-net` alongside about
25 unrelated containers, including the edge proxy. `admin-ui` and `dm-ui`
published host ports `3080` and `3081` on all interfaces. Both proxied `/api/`
to `doc-api` without authentication. The live compose file pins image tags
that differ from `deploy/homelab/compose.yaml`, so deployment edits the live
file in place instead of replacing it with the repository copy.

Remaining deployment steps (each confirmed separately under the Dockhand
guardrails; a pre-change snapshot of the live compose and variable list has
been saved):

1. Operator adds `METRICS_AUTH_TOKEN` as an encrypted Dockhand variable.
2. Merge `DEV_MODE=false` into the stack variables.
3. Apply four edits to the live compose file: `frontend` joins
   `nexus-internal-net`; `doc-api` leaves `homelab-net`; `METRICS_AUTH_TOKEN`
   becomes required; `admin-ui` and `dm-ui` are removed.
4. Redeploy with image pulls, then remove any orphaned `admin-ui`/`dm-ui`
   containers.
5. Verify the Phase 0 gate from the public route and the LAN.

Implemented behaviors:

- The public gateway (`apps/vtt/docker/nginx.conf`) returns `404` for
  `/codex-admin`, `/api/admin/`, `/api/documents/bulk`,
  `/api/documents/:id/process`, `/api/deduplication/`, `/api/processing/`,
  `/api/references/`, and `/api/annotations/`.
- The generic `/codex-api/` doc-api proxy is gone. Only four DM UI reads
  remain reachable under `/codex-api/`: `/api/search/quick`,
  `/api/structured-data`, `/api/documents/:id`, and
  `/api/documents/:id/content`. These are GET/HEAD only (`limit_except GET`)
  and gated by an nginx `auth_request` against the VTT backend's new
  `GET /auth/session-check` (`apps/vtt/server/routes/auth.routes.ts`), which
  returns `204` for a signed-in, non-guest VTT account and `401` otherwise.
  `/codex-ws` is unchanged; it already requires a JWT. The proxy strips the
  browser's `Cookie` and `Authorization` headers before forwarding to
  `doc-api`.
- `/api/metrics/*` on the VTT backend (`delta-sync`, `ordered-events`,
  `realtime`, `multiplayer`) now requires the same `METRICS_AUTH_TOKEN` bearer
  token that already guarded `/metrics`, compared in constant time. Homelab
  Compose
  (`compose.yaml`, `compose.vtt.yaml`) now fails to start without
  `METRICS_AUTH_TOKEN` set (`${METRICS_AUTH_TOKEN:?...}`), instead of
  silently serving `/metrics` unauthenticated when the variable was empty.
- Homelab network containment: `doc-api` is now on `nexus-internal-net` only
  (removed from the shared `homelab-net`); `frontend` joined
  `nexus-internal-net` so the gateway can still reach it. The standalone
  `admin-ui` and `dm-ui` containers are removed from the stack (invariant 3):
  they published host ports `3080`/`3081`, and once `doc-api` leaves
  `homelab-net` their Nginx cannot resolve it and would crash-loop. The
  unified gateway already serves `/codex-dm/`. The Codex Admin UI has no
  network path until Phase 1.
- The Lobby Development Tools panel (`LinearWelcomePage.tsx`) no longer shows
  the "Admin Panel" button or the "Codex Admin UI" link.

Route classification (old public path -> new public behavior -> reason):

| Old public path                                                                               | New public behavior                                                      | Reason                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/codex-admin`, `/codex-admin/*`                                                              | `404`                                                                    | Admin SPA has no authenticated public surface until Phase 1's private hostname exists                                                                                                           |
| `/api/admin/*`                                                                                | `404`                                                                    | Unauthenticated `doc-api` admin API; never safe on the public vhost while `AUTH_DISABLED=true`                                                                                                  |
| `/api/documents/bulk`                                                                         | `404`                                                                    | Bulk ingestion is an admin action, not a player/DM function                                                                                                                                     |
| `/api/documents/:id/process`                                                                  | `404`                                                                    | Reprocessing trigger is an admin action                                                                                                                                                         |
| `/api/deduplication/*`                                                                        | `404`                                                                    | Admin-only maintenance surface                                                                                                                                                                  |
| `/api/processing/*`                                                                           | `404`                                                                    | Admin-only maintenance surface                                                                                                                                                                  |
| `/api/references/*`                                                                           | `404`                                                                    | Not an approved player/DM function; no VTT BFF equivalent yet                                                                                                                                   |
| `/api/annotations/*`                                                                          | `404`                                                                    | Not an approved player/DM function; no VTT BFF equivalent yet                                                                                                                                   |
| `/codex-api/*` (generic proxy)                                                                | `404` except four allowlisted GET reads                                  | A blanket proxy to `doc-api` bypassed authentication entirely; only the DM UI's actual read calls are preserved                                                                                 |
| `/codex-api/api/search/quick`, `/structured-data`, `/documents/:id`, `/documents/:id/content` | Proxied, GET/HEAD only, gated by `auth_request` -> `/auth/session-check` | These are the DM UI's real read calls (`apps/codex/services/dm-ui/src/services/codex-api.ts`); scoping and authenticating them keeps the DM planner working without reopening the generic proxy |
| `/codex-ws`                                                                                   | Unchanged                                                                | Already requires a JWT                                                                                                                                                                          |

Known behavior change: the four remaining `/codex-api/` reads used by the DM
UI now require a **signed-in, non-guest** VTT account. A guest session (the
common way to start a quick game) gets `401` from `/auth/session-check` and
the DM planner's document reads will fail until the user is authenticated
with a real account. This was not previously enforced at the gateway.

Accepted tradeoff: the gate checks authentication, not per-document
authorization. Because self-registration creates a signed-in account, any
registered user can read any Codex document through these four paths.
Previously the same reads were anonymous and writes were open, so this is a
strict improvement, and no mutation is reachable.

Follow-ups carried out of Phase 0:

- Move the DM UI onto the VTT backend's authorized document routes
  (`apps/vtt/server/routes/documents.ts`), then remove `/codex-api/`
  entirely. The search parameters (`term` versus `query`) and campaign scoping
  differ, so this needs client and contract changes.
- Configure the Prometheus scrape with the metrics bearer token when
  Prometheus is deployed in Phase 3 (`monitoring/prometheus.yml`).
- Publish the updated documentation (manual `docs-pages.yml` run or the next
  docs-changing push to `main`).

### Phase 1 - Establish private ingress

Phase 1 delivers the network path only. The existing Admin UI calls
`/api/admin/*` and `/api/documents/bulk` directly, and the authenticated
`control-api` that replaces those calls arrives in Phase 2. Proxying them to
`doc-api` from the private listener would break invariant 2, because other
`homelab-net` containers and any LAN or VPN device can reach that listener. The
private host therefore serves a static placeholder and liveness endpoint until
Phase 2.

Prerequisites (operator):

- Finish the Phase 0 deployment and verify its gate.
- Confirm the LAN subnet (expected `192.168.100.0/24`) and the Firewalla
  WireGuard client subnet.
- Confirm WireGuard client profiles use the Firewalla as their DNS resolver.
  The Firewalla serves local DNS records to LAN and WireGuard clients
  (confirmed 2026-09-23). Do not use a public record that points at a private
  address; Firewalla DNS-rebinding protection may block it.
- Create a Cloudflare API token scoped to Zone:DNS:Edit for `nexusvtt.com`, for
  Nginx Proxy Manager's DNS-01 challenge. The operator enters it in Nginx Proxy
  Manager; it never goes into Git or Compose.

Deliverables:

- **Edge client-address audit.** Record how Nginx Proxy Manager determines the
  client address (`real_ip`/`set_real_ip_from` settings, Cloudflare trust).
  The admin access list must evaluate the TCP peer address. If Nginx Proxy
  Manager substitutes `X-Forwarded-For`, `X-Real-IP`, or `CF-Connecting-IP`
  from a source the internet can reach, a forged header could satisfy the
  allowlist; remove that trust for the admin host before creating it.
- **Firewalla review.** Confirm the only WAN port forward is `443` to
  HomePod, that Nginx Proxy Manager's own admin UI (`:81`) and `:80` are not
  forwarded, and whether WAN `443` can be restricted to Cloudflare's published
  ranges. That restriction also blocks direct-to-origin probing of every
  hostname.
- **DNS.** Add the `admin.internal.nexusvtt.com` local DNS record on the
  Firewalla, and confirm WireGuard clients resolve it and that public resolvers
  do not.
- **TLS.** Issue `*.internal.nexusvtt.com` through Nginx Proxy Manager with
  DNS-01 and confirm automatic renewal.
- **Private listener.** Add a `listen 8081` server block to
  `apps/vtt/docker/nginx.conf`, serving only a static placeholder page and a
  dependency-free liveness endpoint. Give it a strict CSP (no `unsafe-inline`,
  no Cloudflare beacon), `frame-ancestors 'none'`, `X-Frame-Options: DENY`, and
  `Referrer-Policy: no-referrer`. Do not publish `8081` on the host.
- **Edge route.** Create the Nginx Proxy Manager proxy host
  `admin.internal.nexusvtt.com` -> `frontend:8081` with an access list that
  allows only the LAN and WireGuard subnets and denies everything else, with
  no basic-auth "satisfy any" bypass.
- **Automated tests.** Extend the Phase 0 Nginx regression test, and run the
  stub-container curl matrix in CI against both listeners. Cover: admin paths
  denied on `:80` for every Host header (including
  `admin.internal.nexusvtt.com`); only the placeholder and liveness endpoints
  served on `:8081`; path, encoding, and method variations; and no `doc-api` or
  backend `proxy_pass` inside the private server block.
- **Manual probes.** Document and run external probes over a phone hotspot
  with WireGuard off:
  - public DNS returns no answer for the admin hostname;
  - a direct request to the home IP with `Host`/SNI `admin.internal.nexusvtt.com`
    is refused, including with forged `X-Forwarded-For`, `X-Real-IP`, and
    `CF-Connecting-IP` headers.

  Repeat with WireGuard on and expect success.

- **Runbook.** Record the hostname, DNS record, certificate, access-list
  subnets, and the Firewalla configuration in the homelab deployment runbook.

Gate: the hostname has no public DNS answer, and it refuses or cannot be
reached from an external network, even with forged client-address headers. It
serves trusted TLS from the LAN and over WireGuard. No public Host, SNI, or path
variation reaches the private listener. The private listener proxies to no
internal API.

Interim Codex administration (optional): the Codex Admin UI has no hosted path
between the Phase 0 deployment and Phase 2. If document administration is
needed in that window, run the Admin UI locally with its Vite development
server, reaching `doc-api` through an SSH port forward to HomePod. This adds no
server surface; SSH keys are the access control. Before relying on it, verify
that the HomePod host can reach containers on the internal
`nexus-internal-net` bridge.

### Phase 2 - Add control-plane identity and API

Deliverables:

- Implement the Nexus-account identity model (see
  [Identity](#identity)): the `user_roles` relation, a private admin login flow
  on the admin hostname that requires Google sign-in, and an admin session
  separate from the player-facing VTT session.
- Add `control-api` with `/v1/me`, permission middleware, CSRF, rate limits,
  request IDs, redacted structured logging, and audit persistence.
- Add typed internal clients for Codex, the asset service, VTT diagnostics, and
  monitoring queries.
- Replace direct Admin UI fetches to `/api/admin/*` with `/control-api/v1/*`,
  then replace the Phase 1 placeholder on the private listener with the Admin
  UI and the `/control-api/` route.
- Add the first-admin bootstrap procedure and role-management recovery steps.

Gate: authorization tests prove each role's allow/deny matrix, direct service
access remains unavailable, every test mutation emits one audit event, and a
LAN or WireGuard client without an admin role cannot perform any action.

### Phase 3 - Deliver operational visibility

Deliverables:

- Deploy Prometheus and Grafana on internal networks with persistent storage.
- Add PostgreSQL, Redis, host/container, Codex, and asset-service measurements.
- Replace Codex placeholder measurements with real instrumentation or remove
  the misleading values from the UI.
- Build dashboards for overview, user load, multiplayer, persistence, Codex,
  assets, and infrastructure.
- Connect critical alerts to an approved notification channel.
- Add the admin status summary and runbook links.

Gate: controlled dependency failures produce the expected readiness state,
metric change, dashboard signal, and alert without exposing sensitive details.

### Phase 4 - Build the versioned rules registry

Deliverables:

- Add reviewed database migrations for rules entities and revisions.
- Add the shared runtime-validation package and fixtures for 2014/2024 data.
- Implement draft CRUD, validation, preview, publish, history, diff, archive,
  and rollback APIs in the Codex domain.
- Add spell, item, and monster editors first; expand entity types after their
  contracts and consumers are verified.
- Import the current bundled SRD into an isolated environment and compare
  counts, stable identifiers, references, and rendered output.
- Add the published catalog read API and VTT/Forge adapters with bundled
  fallback behavior.

Gate: invalid entities cannot publish, conflicting updates return `409`, an old
published revision can be restored, and VTT/Forge remain usable while Codex is
offline.

### Phase 5 - Add asset administration

Deliverables:

- Add internal admin endpoints to the asset service.
- Add asset browse, metadata, upload, derivative, validation, quarantine, and
  deletion screens to the admin console.
- Add storage-integrity jobs and Prometheus metrics.
- Test path traversal, malicious file types, oversized uploads, duplicate
  hashes, quota behavior, and referenced-asset warnings.

Gate: browser writes flow only through `control-api`, no secret appears in a
client bundle or response, and asset/manifest integrity survives upload,
metadata edit, derivative rebuild, quarantine, and rollback tests.

### Phase 6 - Retire misleading entry points

Deliverables:

- Remove the production-facing Admin Panel button from lobby development tools.
  Done early in Phase 0, together with the "Codex Admin UI" link.
- For authenticated platform administrators on an eligible private network,
  optionally show an external `Open Control Plane` link using runtime config.
- Keep the frozen local VTT `/admin` editor dev-only until it is deleted under a
  separate ADR or cleanup change.
- Rename the UI from Codex Admin to Nexus Control Plane once all three modules
  are present.
- Update deployment, recovery, and operator documentation.

Gate: production users cannot navigate to a dead `/admin` route, administrators
have one documented private entry point, and no production workflow depends on
the frozen VTT editor.

## Verification matrix

| Area              | Required evidence                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network isolation | No public DNS answer; external requests refused even with forged client-address headers; public listener denies admin paths for every Host; LAN and WireGuard succeed |
| Authentication    | Anonymous, expired, revoked, and non-admin sessions are denied                                                                                                        |
| Authorization     | Automated permission matrix for all roles and route groups                                                                                                            |
| Browser security  | CSRF, origin, cookie, CSP, and clickjacking tests pass                                                                                                                |
| Audit             | Successes, denials, conflicts, and failures are attributable and redacted                                                                                             |
| Rules             | Schema, cross-reference, revision, conflict, publish, rollback, and offline-fallback tests                                                                            |
| Assets            | Upload, metadata, derivatives, integrity, quarantine, path, and authorization tests                                                                                   |
| Operations        | Real metrics replace placeholders; dashboards and alerts respond to injected failures                                                                                 |
| VTT regression    | Login, document library, assets, Forge, room creation, and two-client sync pass                                                                                       |
| Recovery          | Previous gateway/image set can be restored without deleting databases or volumes                                                                                      |

## Deployment and rollback

Roll out the gateway denial separately from feature work so the current public
exposure closes early. Introduce private ingress before moving any admin API.
Deploy database migrations before services that require them, using reviewed,
idempotent migration procedures.

For Dockhand deployment:

1. Read the stack's current raw `.env` content.
2. Merge new keys without removing or rewriting unrelated values.
3. Verify required VTT durability migrations before restarting backend replicas.
4. Render and review the Compose configuration without printing secrets.
5. Deploy one independently reversible phase at a time.
6. Verify frontend `/health` and backend `/api/system/health` after each phase.
7. Verify the public denial and private admin probes from their respective
   networks.

Rollback restores the previous known-good image digests and gateway
configuration. Never use `down -v`, delete named volumes, replace the raw
environment wholesale, or point a previous application image at a schema it
cannot read. Published content revisions are rolled back by publication, not by
deleting history.

## Documentation updates required during implementation

- Record the final hostname, DNS, TLS, and network policy in the homelab
  deployment runbook.
- Add an ADR for the control API, identity authority, and role model.
- Add API reference pages for the browser-facing control contract and internal
  service contracts.
- Document first-admin bootstrap and break-glass recovery without storing
  credentials in Git.
- Add rules schema/versioning and publication semantics to Codex architecture.
- Add asset-admin and integrity workflows to the VTT asset documentation.
- Add dashboard ownership, alert response, retention, and backup procedures to
  operations documentation.

## Completion criteria

The work is complete when:

- no privileged admin UI or API is reachable through the public VTT ingress;
- the control plane is reachable only from the home LAN or over the Firewalla
  WireGuard VPN, at `admin.internal.nexusvtt.com`, with trusted TLS;
- every request is authenticated and every mutation is authorized and audited;
- administrators can manage documents, versioned rules content, and image
  assets without direct database, container, or filesystem access;
- published rules changes are validated, versioned, reversible, and consumed by
  VTT/Forge with a bundled offline fallback;
- Grafana shows real application, database, queue, storage, and user-load
  telemetry with actionable alerts; and
- the lobby no longer points users at the frozen production-inaccessible VTT
  admin route.

## References

- [VTT admin panel decision](/vtt/adr/admin-panel-frozen)
- [NexusCodex homelab deployment](/codex/operations/nexuscodex-homelab)
- [NexusCodex boundary](/vtt/roadmap/ADR/nexuscodex-boundary)
- [Asset service shape](/vtt/roadmap/ADR/asset-service-shape)
- [Asset service authentication](/vtt/roadmap/ADR/asset-service-auth)
- [Multiplayer observability](/vtt/operations/multiplayer-observability)
