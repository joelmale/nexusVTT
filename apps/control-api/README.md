# control-api

Authenticated, authorized, and audited API for the private admin console
(`admin.internal.nexusvtt.com`). Spec: `apps/docs/platform/control-api-adr.md`.

- Port `4000` (container only). Browser base path `/control-api/v1`.
- `GET /healthz` -> `200 ok` (liveness). `GET /readyz` -> `200`/`503`, PostgreSQL only.
- Google OIDC (code + PKCE + state + nonce, signed ID token). Login:
  `GET /control-api/v1/auth/login[?returnTo=/path]`; callback
  `/control-api/v1/auth/google/callback`.
- Session cookie `__Host-nexus_admin` (Secure, HttpOnly, SameSite=Strict,
  Path=/, 30 min idle, 12 h absolute). Only sha256 of its ID is stored.
- Unsafe methods need `Origin: $ADMIN_ORIGIN` and `X-CSRF-Token` (from
  `GET /me`). Destructive/index/admin routes need a login within 10 minutes,
  else `401 {"error":"reauth_required"}`.
- Codex: `/control-api/v1/codex/<path>` -> doc-api `/api/<path>` only for
  entries in `src/codex/allowlist.ts`; anything else is `404`. Uploads
  (`POST codex/documents/upload`) and page images
  (`GET codex/documents/:id/pages/:page/image`) talk to object storage
  server-side.
- Assets: `/control-api/v1/assets/<path>` -> asset-service
  `/internal/admin/<path>` (`src/assets/allowlist.ts`).
- Rules: `/control-api/v1/rules/<path>` -> doc-api `/api/admin/rules/<path>`
  (`src/rules/allowlist.ts`).
- Operations: `GET /control-api/v1/operations/summary` (`src/operations/`).

## Environment

`CONTROL_DATABASE_URL`, `DOC_API_URL`, `ADMIN_ORIGIN`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `CONTROL_GOOGLE_CALLBACK_URL`, `CONTROL_SESSION_SECRET`
(>= 32 chars), `TRUST_PROXY_HOPS`, `ASSET_SERVICE_SECRET` (>= 16 chars).
Optional: `PORT`, `LOG_LEVEL`, `ASSET_SERVICE_URL`, `BACKEND_URL`,
`PROMETHEUS_URL`, `GRAFANA_URL`, `RULES_ADMIN_SERVICE_TOKEN`,
`CODEX_OBJECT_STORAGE_URL`. Startup fails if any required variable is missing
or invalid.

## Database

Apply `apps/vtt/server/migrations/2026-09-24-add-control-plane-identity.sql`
as the database owner, then run its commented Section 2 once to create the
`nexus_control` role and set its password interactively (`\password`).

## Bootstrap and recovery

```sh
docker compose run --rm control-api node dist/cli.js grant-role --email you@example.com --role platform_admin
docker compose run --rm control-api node dist/cli.js list-admins
docker compose run --rm control-api node dist/cli.js revoke-role --email old@example.com --role operator
```

The user must have signed in to Nexus VTT with Google first. The CLI refuses
to revoke the last active `platform_admin`. Every change writes an audit row
with actor `cli`.

## Development

```sh
npm run build --workspace=nexus-control-api
npm run test --workspace=nexus-control-api   # PostgreSQL tests need Docker
npm run lint --workspace=nexus-control-api
docker build -f apps/control-api/Dockerfile .
```

Rate limits are in memory (per replica): 10 logins/client/min, 300 API
requests/session/min.
