---
title: 'ADR: Control API, identity, and roles'
---

# ADR: Control API, identity, and roles

- Date: 2026-09-24
- Status: Accepted
- Plan: [Private admin control plane](./private-admin-control-plane.md), Phase 2

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
| Networks         | `nexus-internal-net` (PostgreSQL, `doc-api`) and a dedicated `nexus-control-egress-net` (Google)    |

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

Startup fails fast if any required variable is missing. No default
administrator, credential, or email allowlist exists anywhere.

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
| `audit:read`      | Read the audit log                                                   |
| `admins:manage`   | Grant and revoke roles                                               |

| Role             | Permissions                                                                     |
| ---------------- | ------------------------------------------------------------------------------- |
| `platform_admin` | all                                                                             |
| `content_editor` | `codex:read`, `codex:write`                                                     |
| `operator`       | `codex:read`, `codex:maintain` (queue retry and clean only), `audit:read`       |
| `auditor`        | `codex:read`, `audit:read`                                                      |

`codex:delete`, `codex:maintain` index operations, and `admins:manage` also
require **recent authentication**: a Google login within the last 10 minutes.
Otherwise the API returns `401` with `{"error":"reauth_required"}`.

### Sessions and browser security

- Cookie `__Host-nexus_admin` with `Secure`, `HttpOnly`, `SameSite=Strict`,
  `Path=/`, and no `Domain`. It holds a random session ID; state lives in
  PostgreSQL (`admin_sessions`).
- Idle timeout 30 minutes, absolute lifetime 12 hours. The ID rotates at login
  and whenever roles change.
- Every non-`GET`/`HEAD` request requires the `X-CSRF-Token` header to match the
  session's token, and the `Origin` header to equal `ADMIN_ORIGIN`.
- Every response has an `X-Request-Id`. An inbound `X-Request-Id` from the
  gateway is reused if it is a UUID; otherwise one is generated.
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
| `* /codex/<path>`                                 | per allowlist   | Explicit allowlist, see below                     |

**Codex allowlist.** `/control-api/v1/codex/<path>` maps to `doc-api`
`/api/<path>` only for method and path patterns listed in one table in
`apps/control-api`. Each entry names its permission and whether it is audited.
The table covers exactly the calls the Admin UI makes. Anything not listed
returns `404` without contacting `doc-api`. Path parameters are validated
(`[A-Za-z0-9_-]+`); query strings are passed through only for listed keys.
Request bodies are size-limited, and multipart bulk upload is streamed with a
size cap. `doc-api` errors are normalized to
`{ error, requestId }` without internal hostnames or stack traces. The client
does not forward browser cookies or `Authorization` to `doc-api`.

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
  from `control-api` without changing the browser contract.
