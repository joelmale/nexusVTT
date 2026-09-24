---
title: Control plane operator runbook
---

# Control plane operator runbook

- Date: 2026-09-24
- Applies to: [`control-api` ADR](./control-api-adr.md), Phase 2 of the
  [private admin control plane plan](./private-admin-control-plane.md)

This runbook is operator-facing. It contains no real credentials, hostnames of
secrets, or tokens — every example value below is a placeholder.

## 1. Prerequisites

Complete these once, before the first deployment.

### 1.1 Google OAuth client

`control-api` reuses the existing Nexus Google OAuth client
(`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`), so no new client is required.
Add one additional authorized redirect URI to that existing client in the
Google Cloud Console:

```
https://admin.internal.nexusvtt.com/control-api/v1/auth/google/callback
```

Administrators must already have signed in to Nexus VTT with this Google
account at least once — `control-api` refuses login for a Google identity
with no matching `users` row (see the ADR's Identity section).

### 1.2 Generate `CONTROL_SESSION_SECRET`

Generate a random 32-byte secret and store it only in the Dockhand encrypted
variable store, never in Git:

```bash
openssl rand -hex 32
```

### 1.3 Create the `nexus_control` database role

Connect to the production PostgreSQL instance as an administrator and create
a least-privilege role. Choose your own password; do not reuse the
application's superuser password.

```sql
CREATE ROLE nexus_control WITH LOGIN PASSWORD 'operator-chosen-password';
```

The migration in step 2 grants this role exactly the columns and tables it
needs (see the ADR's Data model section: scoped access to `users`, full
access to `admin_sessions`/`admin_identities`, `SELECT`/`INSERT`/`UPDATE` on
`user_roles`, append-only `admin_audit_events`). It has no access to game,
campaign, or session tables.

Build `CONTROL_DATABASE_URL` from that role and the existing database:

```
postgresql://nexus_control:<operator-chosen-password>@postgres:5432/nexus
```

Store it as an encrypted Dockhand variable.

## 2. Apply the database migration

Apply the migration **before `control-api` is added to the stack or started
for the first time.** It is idempotent, so re-running it is safe.

```bash
psql "$DATABASE_URL" -f apps/vtt/server/migrations/2026-09-24-add-control-plane-identity.sql
```

Use the existing superuser `DATABASE_URL` for this step (it needs to
`CREATE TABLE`/`GRANT`), not `CONTROL_DATABASE_URL`. Confirm the new tables
exist before continuing:

```sql
\dt user_roles admin_identities admin_sessions admin_audit_events
```

## 3. Dockhand deployment order

Follow the plan's standing deployment discipline (section "Deployment and
rollback"): merge the raw `.env`, never replace it; deploy one reversible
phase at a time; verify health after each phase.

1. **Merge environment variables.** Read the stack's current raw `.env`,
   then add the new keys without removing or rewriting unrelated values:
   - `CONTROL_DATABASE_URL` (secret, from step 1.3)
   - `CONTROL_SESSION_SECRET` (secret, from step 1.2)
   - `GOOGLE_CLIENT_SECRET` — already present; reused as-is
   - `ASSET_ADMIN_SERVICE_SECRET` — a 32+ character admin-only credential
     shared only by `control-api` and the asset service
   - `RULES_ADMIN_SERVICE_TOKEN` — a 32+ character service token shared by
     `control-api` and `doc-api`
   - `CONTROL_API_IMAGE` (optional; defaults to
     `ghcr.io/joelmale/nexusvtt/control-api:latest`)

   See `deploy/homelab/.env.example` for the full documented list and
   `deploy/homelab/compose.vtt.yaml` / `deploy/homelab/compose.yaml` for how
   each variable is consumed. `ADMIN_ORIGIN`, `DOC_API_URL`,
   `CONTROL_GOOGLE_CALLBACK_URL`, and `TRUST_PROXY_HOPS` are fixed plain
   values baked into the compose service definition; they do not need to be
   set in `.env`.

2. **Add the compose service.** Merge the `control-api` service definition
   from this repository's `deploy/homelab/compose.yaml` (or the
   `compose.infra.yaml` + `compose.codex.yaml` + `compose.vtt.yaml` split, if
   the live stack uses the modular files) into the live Dockhand stack
   definition, alongside the existing services. Do not replace the live file
   wholesale — the live definition may already differ from the repository
   copy in image tags or other site-specific pins (see the Phase 0 status
   notes in the plan document).

3. **Confirm the migration from step 2 has already been applied.** `control-api`
   fails fast at startup if a required environment variable is missing, but
   it does not run the migration itself.

4. **Deploy.** Redeploy the stack so `control-api` starts. It joins
   `nexus-internal-net` (to reach PostgreSQL and `doc-api`) and the dedicated
   `nexus-control-egress-net` (outbound only, for the Google OAuth token
   exchange). It must never join `homelab-net`, and it publishes no host
   port — port 4000 is container-only.

5. **Verify `/readyz` through the admin host**, once the private
   `admin.internal.nexusvtt.com` listener and `/control-api/` proxy route
   exist (Phase 1 deliverable):

   ```bash
   curl -fsS https://admin.internal.nexusvtt.com/control-api/readyz
   ```

   Expect `200`. A `503` means PostgreSQL is unreachable from `control-api`;
   check `CONTROL_DATABASE_URL` and that `nexus-internal-net` is attached.

## 4. First-admin bootstrap

No default administrator, credential, or email allowlist exists. Grant the
first `platform_admin` role once, through the CLI shipped in the
`control-api` image:

```bash
docker compose run --rm control-api node dist/cli.js grant-role \
  --email operator@example.com \
  --role platform_admin
```

Use the Dockhand equivalent (its "run a one-off command in a stack service"
action) if `docker compose run` is not directly available on the host. The
target email must already belong to an existing Google-provider `users` row
(see step 1.1) — the CLI grants a role, it does not create identities.

Confirm the grant:

```bash
docker compose run --rm control-api node dist/cli.js list-admins
```

## 5. Break-glass recovery

- **Revoke a role** (including a compromised or mistaken grant):

  ```bash
  docker compose run --rm control-api node dist/cli.js revoke-role \
    --email operator@example.com \
    --role platform_admin
  ```

  The API also refuses to remove the last active `platform_admin` through
  its own `/administrators/revocations` route; the CLI is the only way to
  remove the last one, for genuine break-glass situations.

- **List current administrators and their roles** at any time:

  ```bash
  docker compose run --rm control-api node dist/cli.js list-admins
  ```

- **Disable all admin access immediately** without touching identity or role
  data: stop the `control-api` container/service. With `control-api` down,
  the private listener has nothing to proxy `/control-api/` to, so no
  browser session (new or existing) can authenticate or act. This does not
  invalidate already-issued session cookies in the database, but with the
  service stopped they cannot be used. Restart `control-api` once the
  incident is resolved; existing non-expired sessions remain valid unless
  you also clear the `admin_sessions` table.

## 6. Rollback

- **Image rollback:** redeploy the stack pointing `CONTROL_API_IMAGE` at the
  previous known-good digest (see `release/images.json` from the CI run that
  published it, or the Dockhand image history for the `control-api` service).
  `control-api` is stateless aside from PostgreSQL, so rolling the image back
  and forward is safe as long as the database migration below stays applied.
- **Migration:** the migration in step 2 is additive only (new tables; no
  column drops or type changes on existing tables) and should stay applied
  even during a rollback to an older `control-api` image. Do not reverse it
  as part of a rollback.
- Never use `docker compose down -v`, delete named volumes, or replace the
  raw `.env` wholesale as part of a rollback (plan-wide invariant).

## 7. Verification checklist

After any deployment or configuration change, verify:

- [ ] **Login.** An administrator with an active role can sign in with Google
      at `https://admin.internal.nexusvtt.com/control-api/v1/auth/login` and
      reach `GET /control-api/v1/me` with a `200` and their roles/permissions.
- [ ] **Role denial.** A signed-in Google user with **no** active
      `user_roles` row is refused with `403` after login, and the refusal
      produces one `admin_audit_events` row with `outcome = 'denied'`.
- [ ] **CSRF rejection.** A non-`GET`/`HEAD` request without a matching
      `X-CSRF-Token` header, or with an `Origin` that does not equal
      `ADMIN_ORIGIN`, is rejected.
- [ ] **Audit rows.** Every login success/failure, every permission denial,
      and every role grant/revocation each produce exactly one
      `admin_audit_events` row (`SELECT * FROM admin_audit_events ORDER BY
      occurred_at DESC LIMIT 20;`), with no document content, cookies,
      tokens, or secrets in the `summary` column.
- [ ] **Network isolation.** `control-api` is reachable from `frontend` and
      `doc-api`/`postgres` only. It is not attached to `homelab-net`, and no
      host port is published for it (`docker inspect` the container and
      confirm `Ports` is empty and `homelab-net` is absent from
      `NetworkSettings.Networks`).
