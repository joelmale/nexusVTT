---
title: Private admin control plane implementation plan
---

# Private admin control plane implementation plan

- Date: 2026-09-23
- Status: Phase 0 implemented in repository; not yet deployed

## Outcome

Build a private Nexus administration surface for content authoring, asset
management, and application operations. The control plane must be reachable
only from the trusted LAN or an approved VPN, require an authenticated platform
administrator, and avoid exposing internal services through the public
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
trusted LAN or approved VPN
            |
            v
admin.nexusvtt.home.arpa       private DNS only; no public DNS/tunnel
            |
            v
existing edge proxy            TLS + source-network policy
            |
            v
frontend Nginx private vhost   admin SPA + /control-api only
            |
            v
control-api                    authentication, RBAC, CSRF, audit, aggregation
     |             |              |                 |
     v             v              v                 v
  doc-api      asset-service   VTT backend       Prometheus/Grafana
  internal       internal       internal APIs      internal only
```

`admin.nexusvtt.home.arpa` is the proposed default. A split-horizon hostname or
VPN-provided hostname is acceptable if it has the same properties: private name
resolution, trusted TLS, no public reverse-proxy route, and an explicit network
access policy.

The private hostname is not the only security boundary. Authentication and
authorization remain mandatory because a compromised or untrusted LAN client
must not gain administrative access.

## Routing model

Create separate public and private Nginx server contexts. Do not rely on a
hidden link or frontend route guard.

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

Select one administrative identity authority before implementation:

1. An existing identity-aware proxy, such as Authentik or Authelia, with a
   `nexus-platform-admin` group; or
2. the Nexus account system, extended with durable platform roles and a private
   admin login flow.

An identity-aware proxy is preferred when one already exists in the homelab. If
Nexus owns authorization, add a normalized role relation instead of an email
allowlist:

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

Implemented in repository (uncommitted at time of writing). **Deployment:
pending** -- none of this has been rolled out to the homelab stack yet.

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
  `/codex-ws` is unchanged; it already requires a JWT.
- `/api/metrics/*` on the VTT backend (`delta-sync`, `ordered-events`,
  `realtime`, `multiplayer`) now requires the same `METRICS_AUTH_TOKEN` bearer
  token that already guarded `/metrics`. Homelab Compose
  (`compose.yaml`, `compose.vtt.yaml`) now fails to start without
  `METRICS_AUTH_TOKEN` set (`${METRICS_AUTH_TOKEN:?...}`), instead of
  silently serving `/metrics` unauthenticated when the variable was empty.
- Homelab network containment: `doc-api` is now on `nexus-internal-net` only
  (removed from the shared `homelab-net`); `frontend` joined
  `nexus-internal-net` so the gateway can still reach it; `admin-ui` and
  `dm-ui` no longer publish host ports `3080`/`3081`.
- The Lobby Development Tools panel (`LinearWelcomePage.tsx`) no longer shows
  the "Admin Panel" button or the "Codex Admin UI" link.

Route classification (old public path -> new public behavior -> reason):

| Old public path                    | New public behavior                          | Reason                                                                 |
| ----------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| `/codex-admin`, `/codex-admin/*`    | `404`                                          | Admin SPA has no authenticated public surface until Phase 1's private hostname exists |
| `/api/admin/*`                      | `404`                                          | Unauthenticated `doc-api` admin API; never safe on the public vhost while `AUTH_DISABLED=true` |
| `/api/documents/bulk`               | `404`                                          | Bulk ingestion is an admin action, not a player/DM function            |
| `/api/documents/:id/process`        | `404`                                          | Reprocessing trigger is an admin action                                |
| `/api/deduplication/*`              | `404`                                          | Admin-only maintenance surface                                         |
| `/api/processing/*`                 | `404`                                          | Admin-only maintenance surface                                         |
| `/api/references/*`                 | `404`                                          | Not an approved player/DM function; no VTT BFF equivalent yet          |
| `/api/annotations/*`                | `404`                                          | Not an approved player/DM function; no VTT BFF equivalent yet          |
| `/codex-api/*` (generic proxy)      | `404` except four allowlisted GET reads        | A blanket proxy to `doc-api` bypassed authentication entirely; only the DM UI's actual read calls are preserved |
| `/codex-api/api/search/quick`, `/structured-data`, `/documents/:id`, `/documents/:id/content` | Proxied, GET/HEAD only, gated by `auth_request` -> `/auth/session-check` | These are the DM UI's real read calls (`apps/codex/services/dm-ui/src/services/codex-api.ts`); scoping and authenticating them keeps the DM planner working without reopening the generic proxy |
| `/codex-ws`                         | Unchanged                                      | Already requires a JWT                                                 |

Known behavior change: the four remaining `/codex-api/` reads used by the DM
UI now require a **signed-in, non-guest** VTT account. A guest session (the
common way to start a quick game) gets `401` from `/auth/session-check` and
the DM planner's document reads will fail until the user is authenticated
with a real account. This was not previously enforced at the gateway.

### Phase 1 - Establish private ingress

Deliverables:

- Create private DNS for the selected hostname.
- Issue a trusted certificate through an internal CA, DNS challenge, or the
  approved VPN certificate mechanism.
- Add a private Nginx server context/listener in the unified frontend image.
- Add LAN/VPN source restrictions at the edge proxy or firewall.
- Serve the existing Admin UI only from the private hostname.
- Add automated tests asserting public denial and private availability.

Gate: the hostname is unreachable from an external network, presents trusted
TLS internally, and public-host header/path variations cannot reach it.

### Phase 2 - Add control-plane identity and API

Deliverables:

- Choose the identity authority and implement the role model.
- Add `control-api` with `/v1/me`, permission middleware, CSRF, rate limits,
  request IDs, redacted structured logging, and audit persistence.
- Add typed internal clients for Codex, the asset service, VTT diagnostics, and
  monitoring queries.
- Replace direct Admin UI fetches to `/api/admin/*` with `/control-api/v1/*`.
- Add the first-admin bootstrap procedure and role-management recovery steps.

Gate: authorization tests prove each role's allow/deny matrix, direct service
access remains unavailable, and every test mutation emits one audit event.

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

| Area              | Required evidence                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Network isolation | External DNS/connection fails; public vhost denies admin paths; private LAN/VPN succeeds   |
| Authentication    | Anonymous, expired, revoked, and non-admin sessions are denied                             |
| Authorization     | Automated permission matrix for all roles and route groups                                 |
| Browser security  | CSRF, origin, cookie, CSP, and clickjacking tests pass                                     |
| Audit             | Successes, denials, conflicts, and failures are attributable and redacted                  |
| Rules             | Schema, cross-reference, revision, conflict, publish, rollback, and offline-fallback tests |
| Assets            | Upload, metadata, derivatives, integrity, quarantine, path, and authorization tests        |
| Operations        | Real metrics replace placeholders; dashboards and alerts respond to injected failures      |
| VTT regression    | Login, document library, assets, Forge, room creation, and two-client sync pass            |
| Recovery          | Previous gateway/image set can be restored without deleting databases or volumes           |

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
- the control plane is reachable only over trusted LAN/VPN paths with TLS;
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
