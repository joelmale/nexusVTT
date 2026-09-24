-- Add campaign_actors, domain_command_receipts, legacy_object_ids, and library_objects
-- Supporting Phase 2 of the Forge-VTT Object Integration Plan.

-- 1. Campaign Actors (Authoritative campaign-owned creatures/PCs)
CREATE TABLE IF NOT EXISTS campaign_actors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "campaignId" UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    "sourceRef" JSONB,
    "ownerId" UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    ruleset JSONB NOT NULL,
    "stateVersion" BIGINT NOT NULL DEFAULT 1,
    "currentHp" INTEGER NOT NULL DEFAULT 0,
    "maxHp" INTEGER NOT NULL DEFAULT 0,
    "tempHp" INTEGER NOT NULL DEFAULT 0,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    "deathSaves" JSONB NOT NULL DEFAULT '{"successes": 0, "failures": 0}'::jsonb,
    "resourcePools" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "spellcastingProfiles" JSONB NOT NULL DEFAULT '[]'::jsonb,
    inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
    "activeSessionId" UUID REFERENCES sessions(id) ON DELETE SET NULL,
    payload JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_actors_campaign ON campaign_actors("campaignId");
CREATE INDEX IF NOT EXISTS idx_campaign_actors_session ON campaign_actors("activeSessionId");
CREATE INDEX IF NOT EXISTS idx_campaign_actors_owner ON campaign_actors("ownerId");

-- 2. Domain Command Receipts (Idempotency and deduplication tombstones)
CREATE TABLE IF NOT EXISTS domain_command_receipts (
    "commandId" UUID PRIMARY KEY,
    "principalId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "scopeKind" VARCHAR(32) NOT NULL, -- 'campaign', 'session', 'account'
    "scopeId" UUID NOT NULL,
    "commandType" VARCHAR(64) NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "committedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    result JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_command_receipts_scope ON domain_command_receipts("scopeKind", "scopeId");
CREATE INDEX IF NOT EXISTS idx_command_receipts_committed_at ON domain_command_receipts("committedAt");

-- 3. Legacy Object IDs (Reconciling client-generated and legacy creator IDs)
CREATE TABLE IF NOT EXISTS legacy_object_ids (
    namespace VARCHAR(64) NOT NULL, -- 'character', 'monster', etc.
    "legacyId" VARCHAR(128) NOT NULL,
    "canonicalId" UUID NOT NULL,
    "ownerId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (namespace, "legacyId")
);

CREATE INDEX IF NOT EXISTS idx_legacy_object_ids_canonical ON legacy_object_ids("canonicalId");

-- 4. Library Objects & Revisions (Bestiary, spells, items, encounters)
CREATE TABLE IF NOT EXISTS library_objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "campaignId" UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL, -- 'monster', 'spell', 'item', 'encounter'
    name VARCHAR(255) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    "currentRevision" INTEGER NOT NULL DEFAULT 1,
    "isArchived" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_library_objects_owner ON library_objects("ownerId");
CREATE INDEX IF NOT EXISTS idx_library_objects_campaign ON library_objects("campaignId");
CREATE INDEX IF NOT EXISTS idx_library_objects_kind ON library_objects(kind);

CREATE TABLE IF NOT EXISTS library_object_revisions (
    "objectId" UUID NOT NULL REFERENCES library_objects(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    ruleset JSONB NOT NULL,
    data JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("objectId", revision)
);

-- Trigger for updatedAt on campaign_actors and library_objects
CREATE TRIGGER update_campaign_actors_updated_at BEFORE UPDATE ON campaign_actors FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_library_objects_updated_at BEFORE UPDATE ON library_objects FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
