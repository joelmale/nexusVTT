-- Control-plane identity, sessions, roles, and audit (ADR: Control API,
-- identity, and roles). Idempotent: safe to run more than once. Apply as the
-- database owner before control-api starts.
--
-- Section 2 (the nexus_control role and its grants) is commented out and is
-- run separately by the operator, who sets the role's password out of band.

BEGIN;

CREATE TABLE IF NOT EXISTS user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    -- NULL granted_by/revoked_by means the bootstrap CLI acted.
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT user_roles_role_check CHECK (
        role IN ('platform_admin', 'content_editor', 'operator', 'auditor')
    ),
    CONSTRAINT user_roles_revocation_check CHECK (
        revoked_at IS NULL OR revoked_at >= granted_at
    )
);

-- One active row per (user_id, role); revoked rows are kept as history.
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_active_idx
    ON user_roles (user_id, role)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS user_roles_active_role_idx
    ON user_roles (role)
    WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_identities (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'google',
    subject TEXT NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT admin_identities_provider_check CHECK (provider = 'google'),
    CONSTRAINT admin_identities_subject_key UNIQUE (subject)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    -- sha256 (hex) of the random session ID carried in the cookie; the raw
    -- cookie value is never stored.
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    recent_auth_at TIMESTAMPTZ NOT NULL,
    source_ip TEXT,
    CONSTRAINT admin_sessions_id_check CHECK (id ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS admin_sessions_user_idx ON admin_sessions (user_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS admin_audit_events (
    id BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_id TEXT,
    -- No foreign key: audit history must outlive the user row.
    actor_user_id UUID,
    actor_email TEXT,
    identity_provider TEXT,
    role_used TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    prior_version TEXT,
    source_ip TEXT,
    outcome TEXT NOT NULL,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT admin_audit_events_outcome_check CHECK (
        outcome IN ('success', 'denied', 'conflict', 'failure')
    )
);

CREATE INDEX IF NOT EXISTS admin_audit_events_occurred_idx
    ON admin_audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_events_actor_idx
    ON admin_audit_events (actor_user_id, occurred_at DESC);

COMMIT;

-- ---------------------------------------------------------------------------
-- Section 2: least-privilege database role for control-api.
--
-- Run separately as a superuser or the database owner. Do NOT put a password
-- in this file. After creating the role, set its password interactively, e.g.
-- in psql:  \password nexus_control
-- and store the resulting CONTROL_DATABASE_URL as an encrypted Dockhand
-- variable. Replace nexus_vtt below with the actual database name.
--
-- DO $$
-- BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexus_control') THEN
--         CREATE ROLE nexus_control LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
--     END IF;
-- END
-- $$;
--
-- GRANT CONNECT ON DATABASE nexus_vtt TO nexus_control;
-- GRANT USAGE ON SCHEMA public TO nexus_control;
--
-- GRANT SELECT (id, email, name, "displayName", provider, "isActive")
--     ON users TO nexus_control;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON admin_sessions TO nexus_control;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON admin_identities TO nexus_control;
-- GRANT SELECT, INSERT, UPDATE ON user_roles TO nexus_control;
-- GRANT USAGE, SELECT ON SEQUENCE user_roles_id_seq TO nexus_control;
-- GRANT SELECT, INSERT ON admin_audit_events TO nexus_control;
-- GRANT USAGE, SELECT ON SEQUENCE admin_audit_events_id_seq TO nexus_control;
-- ---------------------------------------------------------------------------
