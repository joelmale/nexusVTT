---
title: 'ADR: Control API, identity, and roles'
---

# ADR: Control API, identity, and roles

- Date: 2026-09-24
- Status: Accepted
- Plan: [Private admin control plane](./private-admin-control-plane.md), Phase 2
- Amended: 2026-09-24 (wave 2: operations summary, asset and rules proxies,
  server-side Codex upload and page images)

## Context

The admin console on `admin.internal.nexusvtt.com` (private listener
`frontend:8081`) needs authenticated, authorized, and audited access to
Codex administration. `doc-api` runs with `AUTH_DISABLED=true` and must never
be reachable from a browser. Network position (LAN or WireGuard) is not an
identity: any LAN device or `homelab-net` container can reach the private
listener.

## Decision

Add a dedicated `control-api` service. It is the only browser-facing API on the
private listener and the only component that calls `doc-api` on an
administrator's behalf.

### Service

| Item             | Value                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| Workspace        | `apps/control-api`, npm workspace name `nexus-control-api`                                         |
| Runtime          | Node 26 + TypeScript, Express 5, `zod` validation, `pg` for PostgreSQL                             |
| Port             | `4000` (container only; never host-published)                                                      |
| Image            | `ghcr.io/joelmale/nexusvtt/control-api`, built from `apps/control-api/Dockerfile` (repo-root context) |
| Liveness         | `GET /healthz` -> `200 ok`, no dependency detail                                                   |
| Readiness        | `GET /readyz` -> checks PostgreSQL only; `200`/`503`, no detail in the body                        |
| Browser base     | `/control-api/v1` (the gateway proxies `/control-api/` unchanged)                                  |
| Networks         | `nexus-internal-net` (PostgreSQL, `doc-api`, `asset-server`, `backend`, `codex-minio`, Prometheus) and a dedicated `nexus-control-egress-net` (Google) |

Environment:

| Variable                        | Purpose                                                                |
| -------------------------------- | ---------------------------------------------------------------------- |
| `CONTROL_DATABASE_URL`          | VTT PostgreSQL, connecting as the least-privilege `nexus_control` role |
| `DOC_API_URL`                   | `http://doc-api:3000`                                                   |
| `ADMIN_ORIGIN`                  | `https://admin.internal.nexusvtt.com` (Origin check and redirects)     |
| `GOOGLE_CLIENT_ID`              | Shared with the VTT Google OAuth client                                 |
| `GOOGLE_CLIENT_SECRET`          | Shared; encrypted Dockhand variable                                     |
| `CONTROL_GOOGLE_CALLBACK_URL`   | `https://admin.internal.nexusvtt.com/control-api/v1/auth/google/callback` |
| `CONTROL_SESSION_SECRET`        | Signs the session cookie; encrypted Dockhand variable                   |
| `TRUST_PROXY_HOPS`              | `1` (the frontend gateway)                                              |
| `ASSET_ADMIN_SERVICE_SECRET`    | Required, at least 32 characters. Sent as `x-nexus-admin-auth` to the asset service admin API; distinct from the public VTT backend's `ASSET_SERVICE_SECRET` |
| `ASSET_SERVICE_URL`             | Optional, default `http://asset-server:5003`                            |
| `BACKEND_URL`                   | Optional, default `http://backend:5001` (VTT health for the operations summary) |
| `PROMETHEUS_URL`                | Optional (for example `http://prometheus:9090`); unset means no metrics or alerts in the summary |
| `GRAFANA_URL`                   | Optional browser-facing Grafana link for the summary; unset gives `links.grafana: null` |
| `RULES_ADMIN_SERVICE_TOKEN`     | Required, at least 32 characters. Sent as `X-Nexus-Service-Token` to the rules admin API. `doc-api` must be given the same value |
| `CODEX_OBJECT_STORAGE_URL`      | Optional, default `http://codex-minio:9000`. The only origin control-api fetches presigned object-storage URLs from |

Startup fails fast if any required variable is missing or invalid (URLs must
be `http(s)` without credentials). Compose renders unset optional variables as
empty strings, and control-api treats those as unset. No default
administrator, credential, or email allowlist exists anywhere.

In `deploy/homelab`, control-api's optional Prometheus and Grafana values come
from `CONTROL_PROMETHEUS_URL` and `CONTROL_GRAFANA_URL`.
`RULES_ADMIN_SERVICE_TOKEN` is passed to both control-api and doc-api
(`compose.yaml`, `compose.codex.yaml`). `doc-api` fails closed in production
when it is missing, and control-api refuses to start without it.

### Identity

- Administrators sign in with Google (OpenID Connect authorization-code flow
  with `state` and PKCE). MFA is enforced at the Google account.
- The Google ID token must have `email_verified: true`. The verified email is
  matched to an existing `users` row with `provider = 'google'`. If none
  exists, login is refused; the person must sign in to Nexus VTT with Google
  first.
- On first admin login the Google subject (`sub`) is recorded in
  `admin_identities`. Afterwards the subject must match, so an email reassigned
  at Google cannot inherit access.
- Authorization comes only from active `user_roles` rows. A user without an
  active role is refused after login (`403`), and the refusal is audited.

### Roles and permissions

| Permission        | Meaning                                                              |
| ----------------- | ---------------------------------------------------------------------- |
| `codex:read`      | Read documents, queue, validation, search, stats, logs, health       |
| `codex:write`     | Edit metadata and tags, upload, reprocess, retry jobs                |
| `codex:delete`    | Delete documents, bulk delete, merge duplicates, delete tags         |
| `codex:maintain`  | Index recreate/reindex, queue clean, validation auto-fix             |
| `codex:operate`   | Queue retry/clean and alert acknowledge/resolve (a slice of `codex:maintain`) |
| `audit:read`      | Read the audit log                                                   |
| `admins:manage`   | Grant and revoke roles                                               |
| `ops:read`        | Read the operations summary                                          |
| `assets:read`     | Browse, preview, and inspect library assets, jobs, and integrity; delete preview |
| `assets:write`    | Upload, edit metadata, regenerate derivatives, quarantine, restore, start jobs |
| `assets:delete`   | Permanently delete a quarantined asset                               |
| `rules:read`      | Read rules entities, revisions, previews, and diffs                  |
| `rules:write`     | Create entities, save drafts, validate                               |
| `rules:publish`   | Publish, roll back, archive, and unarchive                           |

| Role             | Permissions                                                                     |
| ---------------- | ------------------------------------------------------------------------------- |
| `platform_admin` | all                                                                             |
| `content_editor` | `codex:read`, `codex:write`, `assets:read`, `assets:write`, `rules:read`, `rules:write` |
| `operator`       | `codex:read`, `codex:operate`, `audit:read`, `ops:read`, `assets:read`          |
| `auditor`        | `codex:read`, `audit:read`, `ops:read`, `assets:read`, `rules:read`             |

`codex:delete`, `codex:maintain` index operations, `admins:manage`, asset
permanent delete, and rules publish/rollback/archive/unarchive also require
**recent authentication**: a Google login within the last 10 minutes.
Otherwise the API returns `401` with `{"error":"reauth_required"}`.
`GET /me` returns the caller's effective `permissions` list.

### Sessions and browser security

- Cookie `__Host-nexus_admin` with `Secure`, `HttpOnly`, `SameSite=Strict`,
  `Path=/`, and no `Domain`. It holds a random session ID; state lives in
  PostgreSQL (`admin_sessions`).
- Idle timeout 30 minutes, absolute lifetime 12 hours. The ID rotates at login
  and whenever roles change.
- Every non-`GET`/`HEAD` request requires the `X-CSRF-Token` header to match the
  session's token, and the `Origin` header to equal `ADMIN_ORIGIN`.
- Every response has an `X-Request-Id`. An inbound `X-Request-Id` from the
  gateway is reused if it is a UUID (lower-cased) or an nginx `$request_id`
  (exactly 32 lowercase hex characters); otherwise a UUID is generated. The
  ID is forwarded to every upstream.
- Login `returnTo` must be a same-origin relative path: it starts with a
  single `/`, contains only printable ASCII (no spaces or control
  characters), no backslashes, no `//` prefix, and at most 512 characters.
  Anything else is ignored and the callback redirects to `/`.
- Rate limit: 10 login attempts per client per minute; 300 API requests per
  session per minute.
- Structured JSON logs never include cookies, tokens, secrets, or document
  content.

### Browser-facing routes (`/control-api/v1`)

| Method and path                                   | Permission      | Notes                                             |
| ------------------------------------------------- | --------------- | ------------------------------------------------- |
| `GET /auth/login`                                 | none            | `302` to Google                                   |
| `GET /auth/google/callback`                       | none            | Sets the cookie, `302` to `/`                     |
| `POST /auth/logout`                               | session         | Deletes the session                               |
| `GET /me`                                         | session         | `{ user, roles, permissions, csrfToken, recentAuthUntil }`; `401` without a session |
| `GET /audit/events`                               | `audit:read`    | Paged, newest first                               |
| `GET /administrators`                             | `admins:manage` | Users with active roles                           |
| `POST /administrators/grants`                     | `admins:manage` | `{ email, role }`; recent auth                    |
| `POST /administrators/revocations`                | `admins:manage` | `{ userId, role }`; recent auth; cannot remove the last `platform_admin` |
| `GET /operations/summary`                         | `ops:read`      | Status page data, see below                       |
| `* /codex/<path>`                                 | per allowlist   | Explicit allowlist, see below                     |
| `POST /codex/documents/upload`                    | `codex:write`   | Server-side document upload, see below            |
| `GET /codex/documents/:id/pages/:page/image`      | `codex:read`    | Page image streamed server-side, see below        |
| `* /assets/<path>`                                | per allowlist   | Asset service `/internal/admin/<path>`, see below |
| `* /rules/<path>`                                 | per allowlist   | doc-api `/api/admin/rules/<path>`, see below      |

**Codex allowlist.** `/control-api/v1/codex/<path>` maps to `doc-api`
`/api/<path>` only for method and path patterns listed in one table in
`apps/control-api`. Each entry names its permission and whether it is audited.
The table covers exactly the calls the Admin UI makes. Anything not listed
returns `404` without contacting `doc-api`. Path parameters are validated
(`[A-Za-z0-9_-]+`); query strings are passed through only for listed keys.
Request bodies are size-limited: 1 MB at most, except the 200 MB server-side
upload. `doc-api` errors are normalized to `{ error, requestId }` without
internal hostnames or stack traces. The client does not forward browser
cookies or `Authorization` to `doc-api`. Annotation
(`POST documents/:id/annotations`), reference (`POST references`), and
bulk-create (`POST documents/bulk`) bodies have `userId` /
`documents[].uploadedBy` overwritten with the session's user ID; client
values are ignored.

**Allowlist rules shared by every proxy** (`src/proxy/`). Each upstream has
one explicit table. Method and raw path must match: literal segments beat
parameters, and `%2F`, `%2e%2e`, `.`/`..`, and empty segments never match.
Path parameters match `[A-Za-z0-9_-]{1,128}`. Only listed query keys pass,
once each, matching a per-key pattern. JSON bodies are accepted only where
listed, with a cap. Unlisted routes are `404` without contacting the
upstream. Redirects are never followed. Only `Content-Type`,
`Content-Length`, `Content-Range`, `Accept-Ranges`, `Content-Disposition`,
`ETag`, and `Last-Modified` come back. Where a table lists them, `If-Match`
and `If-None-Match` are forwarded (one entity tag or revision number;
anything else is `400 invalid_precondition`, never an unconditional write),
and a `304` is relayed. Every mutation is audited once with the upstream
outcome (`409` is `conflict`). The `If-Match` value, or the body's
`expectedVersion`/`expectedRevisionNumber`, is recorded as `prior_version`.

**Server-side Codex upload.** Object storage (MinIO) is never browser-facing,
and presigned URLs never reach the browser. `POST /codex/documents/upload`
takes `multipart/form-data` with exactly one `file` part (`.pdf`, `.md`, or
`.markdown`, at most 200 MB). Optional fields mirror the Admin UI bulk upload
form:

| Field                              | Value                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `title`                            | Default: the file name without its extension                           |
| `description`, `author`            | Free text                                                              |
| `type`                             | `rulebook` (default), `campaign_note`, `handout`, `map`, `character_sheet`, `homebrew` |
| `isPublic`                         | `true` or `false` (default)                                            |
| `batchId`                          | Optional `[A-Za-z0-9_-]` ID to group uploads for `documents/bulk/:batchId/status` |
| `tags`, `campaigns`, `collections` | Repeat the field once per value, or send one JSON array string         |
| `uploadedBy`, `userId`, `format`, `fileName`, `fileSize` | Accepted and ignored                             |

Any other field is `400 invalid_field`. control-api spools the file to a
private temporary directory while enforcing the cap and checking the content:
a PDF must start with `%PDF-`, Markdown must be NUL-free UTF-8, and the
declared part type must be compatible. It then:

1. calls doc-api `POST /api/documents/bulk` with one record (`uploadedBy` is
   the session user; size and format come from the file);
2. PUTs the bytes to the returned presigned URL, which is accepted only on
   `CODEX_OBJECT_STORAGE_URL`'s origin; and
3. calls `POST /api/documents/:id/process`.

The response is `201 { batchId, documents: [document], processingQueued }`.
If the bytes cannot be stored, the new record is deleted again and the
response is `502` with `object_storage_error` or
`object_storage_misconfigured`. Other errors: `413 payload_too_large`,
`415 unsupported_media_type`, `400 file_required | empty_file |
invalid_field | invalid_multipart | invalid_query`, and `502`/`504` for
doc-api failures. Doc-api must sign presigned URLs for the internal MinIO host:
set its `S3_PUBLIC_ENDPOINT` (`CODEX_S3_PUBLIC_ENDPOINT` in `deploy/homelab`)
to `http://codex-minio:9000`.

**Page images.** `GET /codex/documents/:id/pages/:page/image` resolves the
page through doc-api `GET /api/documents/:id/page-images`. It fetches the
presigned URL server-side (same origin rule) and streams
`image/webp|png|jpeg` with `Content-Disposition: inline`,
`X-Content-Type-Options: nosniff`, a `default-src 'none'; sandbox` CSP, and
`Cache-Control: no-store`. No upstream cookies or headers are relayed. A
missing page is `404`.

**Asset allowlist** (`src/assets/allowlist.ts`, 16 routes). It covers every
route in [Asset administration](/vtt/operations/asset-administration).
control-api sends `x-nexus-admin-auth: $ASSET_ADMIN_SERVICE_SECRET` and
`x-nexus-actor: <user id>`.

| Route (below `/control-api/v1/assets/`)                    | Permission                    |
| ---------------------------------------------------------- | ----------------------------- |
| `GET assets`, `facets`, `assets/:id`, `assets/:id/preview`, `jobs`, `jobs/:jobId`, `integrity` | `assets:read` |
| `POST assets/:id/delete-preview` (read-only, not audited)  | `assets:read`                 |
| `POST assets` (multipart, 25 MiB file plus 1 MiB framing), `PATCH assets/:id`, `POST assets/:id/derivatives`, `assets/:id/quarantine`, `assets/:id/restore`, `jobs/manifest-rebuild`, `jobs/integrity-report` | `assets:write` |
| `POST assets/:id/permanent-delete`                         | `assets:delete` + recent auth |

Previews pass only PNG, JPEG, or WebP, with the same safe image headers as
page images. Typed asset-service error bodies for `400`, `404`, `409`, `413`,
`415`, `422`, and `428` are relayed unchanged (for example
`409 version-conflict` with the current asset). `401`, `403`, and `5xx`
become `502 upstream_error`.

**Rules allowlist** (`src/rules/allowlist.ts`, 12 routes). It covers every
internal admin route in the [rules registry](/codex/rules-registry); the
published catalog is not exposed. control-api sends
`X-Nexus-Actor: <user id>` and, when configured, `X-Nexus-Service-Token`.

| Route (below `/control-api/v1/rules/`)                     | Permission                    |
| ---------------------------------------------------------- | ----------------------------- |
| `GET entities`, `entities/:id`, `entities/:id/revisions/:revisionNumber`, `entities/:id/preview`, `entities/:id/diff` | `rules:read` |
| `POST entities`, `PUT entities/:id/draft`, `POST entities/:id/validate` | `rules:write` |
| `POST entities/:id/publish`, `rollback`, `archive`, `unarchive` | `rules:publish` + recent auth |

`If-Match` is forwarded on mutations and `ETag` returned. `RulesErrorResponse`
bodies for `400`, `404`, `409`, and `422` are relayed unchanged, so a
`409 revision_conflict` keeps its `current` head. Entity bodies are capped at
512 KB and transitions at 1 KB.

**Operations summary.** `GET /operations/summary` accepts no query string and
returns:

```text
{ generatedAt,
  services: [{ name, status: 'up'|'degraded'|'down'|'unknown', detail? }],
  metrics: { activeRooms?, websocketConnections?, commitP95Ms?, codexQueueWaiting?,
             codexQueueFailed?, assetMissingFiles?, assetManifestAgeSeconds? },
  alerts: [{ name, severity, since }],
  links: { grafana: string | null, runbooks: [{ title, url }] } }
```

The services are always listed in this order:

| Service         | Source                                                            |
| --------------- | ----------------------------------------------------------------- |
| `vtt-backend`   | `BACKEND_URL/api/system/health`                                   |
| `codex-doc-api` | doc-api `GET /health` (doc-api has no `/api/health`)              |
| `asset-service` | `/internal/admin/integrity` (the latest cached report)            |
| `prometheus`    | `PROMETHEUS_URL` instant queries                                  |

Each source has a 2 s timeout, and all run in parallel. A refused connection
is `down` and a timeout is `unknown`. A non-OK answer, or an integrity report
with missing files or hash mismatches, is `degraded`. A rejected asset
credential or an unconfigured Prometheus is `unknown`. The response is always
`200` and never contains upstream error text, internal hostnames, or secrets.

Metrics come from fixed, allowlisted PromQL instant queries in
`src/operations/summary.ts`, never from request input. Rooms and connections
fall back to the backend health body; missing files come from the integrity
report when it is available. Alerts come from `ALERTS{alertstate="firing"}`,
with `since` from `ALERTS_FOR_STATE` (`null` when unknown), sorted
critical-first, at most 50. Runbook links point at the public docs site.

### Data model (VTT PostgreSQL)

Migration file:
`apps/vtt/server/migrations/2026-09-24-add-control-plane-identity.sql`.
It is idempotent and applied by the operator before `control-api` starts.

```text
user_roles         id, user_id -> users(id), role (check), granted_by, granted_at,
                   revoked_at, revoked_by; one active row per (user_id, role)
admin_identities   user_id -> users(id) PK, provider ('google'), subject UNIQUE, first_seen_at
admin_sessions     id (sha256 of the cookie value) PK, user_id, csrf_token,
                   created_at, last_seen_at, expires_at, recent_auth_at, source_ip
admin_audit_events id, occurred_at, request_id, actor_user_id, actor_email,
                   identity_provider, role_used, action, resource_type,
                   resource_id, prior_version, source_ip,
                   outcome (success | denied | conflict | failure),
                   summary jsonb (redacted)
```

The `nexus_control` database role gets `SELECT (id, email, name, "displayName",
provider, "isActive")` on `users`, full access to `admin_sessions` and
`admin_identities`, `SELECT/INSERT/UPDATE` on `user_roles`, and
`SELECT/INSERT` only on `admin_audit_events`, so audit rows are append-only
through the application. It has no access to game, campaign, or session
tables.

### Audit

Every mutation, every denial (authentication or permission), every login
success or failure, and every role change writes one `admin_audit_events` row.
Where practical this happens in the same transaction as the control-plane
change. Codex mutations are audited after `doc-api` responds, with the outcome.
Summaries contain identifiers and changed field names only; never document
content, credentials, cookies, or tokens.

### Bootstrap and recovery

`control-api` ships a CLI:

- `node dist/cli.js grant-role --email <email> --role platform_admin` grants a
  role to an existing Google user. It is run once by the operator through
  `docker compose run --rm control-api ...` with the same database URL.
- `revoke-role` and `list-admins` exist for break-glass recovery.

Credentials never live in Git, in Compose files, or in a reusable admin
password.

## Consequences

- The Admin UI stops calling `/api/admin/*` and calls
  `/control-api/v1/codex/*` through one client that sends the CSRF header and
  handles `401` by redirecting to `/control-api/v1/auth/login`.
- The private listener serves the Admin UI at `/` and proxies only
  `/control-api/` to `control-api:4000`. It proxies nothing else.
- `doc-api` authentication can later be turned on with a service credential
  from `control-api` without changing the browser contract. The rules admin
  API already supports one (`RULES_ADMIN_SERVICE_TOKEN`).
- Server-side upload and page images need doc-api to sign presigned URLs for
  `http://codex-minio:9000` (`CODEX_S3_PUBLIC_ENDPOINT`); until that is set,
  both return `502` rather than fetching another host.
- control-api needs `ASSET_ADMIN_SERVICE_SECRET` and
  `RULES_ADMIN_SERVICE_TOKEN` to start.
