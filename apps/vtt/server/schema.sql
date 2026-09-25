-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    "displayName" VARCHAR(255),
    bio TEXT,
    "avatarUrl" TEXT,
    provider VARCHAR(50) NOT NULL, -- 'google', 'discord', 'guest'
    "passwordHash" TEXT,
    "passwordSalt" TEXT,
    "passwordIterations" INTEGER DEFAULT 120000,
    preferences JSONB DEFAULT '{}'::jsonb,
    "isActive" BOOLEAN DEFAULT TRUE,
    "lastLogin" TIMESTAMPTZ DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    "dmId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scenes JSONB,
    "lastRoomCode" VARCHAR(10),
    "lastRoomCodeUpdatedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Characters Table
CREATE TABLE IF NOT EXISTS characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions Table (replaces 'rooms')
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY, -- Using UUIDs for session IDs
    "joinCode" VARCHAR(10) UNIQUE NOT NULL,
    "campaignId" UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    "primaryHostId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active',
    "gameState" JSONB NOT NULL,
    "stateVersion" BIGINT NOT NULL DEFAULT 0,
    "syncToken" VARCHAR(64),
    "eventSequence" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "lastActivity" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT status_check CHECK (status IN ('active', 'hibernating', 'abandoned'))
);

-- Ordered, idempotent room event journal. Canonical gameState snapshots remain
-- on sessions; this bounded log fills the gap between a client's last cursor
-- and the latest accepted real-time mutation.
CREATE TABLE IF NOT EXISTS room_events (
    "sessionId" UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    "serverSequence" BIGINT NOT NULL,
    "eventId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "clientSequence" BIGINT NOT NULL,
    envelope JSONB NOT NULL,
    "occurredAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("sessionId", "serverSequence"),
    UNIQUE ("sessionId", "eventId")
);

-- Cross-replica compare-and-swap anchors for versioned token/prop events.
-- Updated in the same transaction as room_events.
CREATE TABLE IF NOT EXISTS room_entity_versions (
    "sessionId" UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    "entityId" TEXT NOT NULL,
    version BIGINT NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("sessionId", "entityId")
);

-- Players Table (associates users with sessions)
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "sessionId" UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    "characterId" UUID REFERENCES characters(id) ON DELETE SET NULL, -- Optional character link
    "isConnected" BOOLEAN DEFAULT TRUE,
    "lastSeen" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE ("userId", "sessionId")
);

-- Hosts Table (for Co-DM support)
CREATE TABLE IF NOT EXISTS hosts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "sessionId" UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    permissions JSONB,
    "isPrimary" BOOLEAN DEFAULT FALSE,
    UNIQUE ("userId", "sessionId")
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_dmId ON campaigns("dmId");
CREATE INDEX IF NOT EXISTS idx_characters_ownerId ON characters("ownerId");
CREATE INDEX IF NOT EXISTS idx_sessions_campaignId ON sessions("campaignId");
CREATE INDEX IF NOT EXISTS idx_sessions_primaryHostId ON sessions("primaryHostId");
CREATE INDEX IF NOT EXISTS idx_sessions_joinCode ON sessions("joinCode"); -- For quick lookup by room code
CREATE INDEX IF NOT EXISTS idx_room_events_replay ON room_events("sessionId", "serverSequence");
CREATE INDEX IF NOT EXISTS idx_room_events_created_at ON room_events("createdAt");
CREATE INDEX IF NOT EXISTS idx_players_userId ON players("userId");
CREATE INDEX IF NOT EXISTS idx_players_sessionId ON players("sessionId");
CREATE INDEX IF NOT EXISTS idx_players_characterId ON players("characterId");
CREATE INDEX IF NOT EXISTS idx_hosts_userId ON hosts("userId");
CREATE INDEX IF NOT EXISTS idx_hosts_sessionId ON hosts("sessionId");

-- Trigger function to update 'updatedAt' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW."updatedAt" = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Campaign Actors Table (Authoritative campaign-owned creatures/PCs)
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

-- Domain Command Receipts (Idempotency and deduplication tombstones)
CREATE TABLE IF NOT EXISTS domain_command_receipts (
    "commandId" UUID PRIMARY KEY,
    "principalId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "scopeKind" VARCHAR(32) NOT NULL,
    "scopeId" UUID NOT NULL,
    "commandType" VARCHAR(64) NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "committedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    result JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_command_receipts_scope ON domain_command_receipts("scopeKind", "scopeId");
CREATE INDEX IF NOT EXISTS idx_command_receipts_committed_at ON domain_command_receipts("committedAt");

-- Legacy Object IDs (Reconciling client-generated and legacy creator IDs)
CREATE TABLE IF NOT EXISTS legacy_object_ids (
    namespace VARCHAR(64) NOT NULL,
    "legacyId" VARCHAR(128) NOT NULL,
    "canonicalId" UUID NOT NULL,
    "ownerId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (namespace, "legacyId")
);

CREATE INDEX IF NOT EXISTS idx_legacy_object_ids_canonical ON legacy_object_ids("canonicalId");

-- Library Objects & Revisions (Bestiary, spells, items, encounters)
CREATE TABLE IF NOT EXISTS library_objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "campaignId" UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL,
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

CREATE TABLE IF NOT EXISTS encounter_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "campaignId" UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    "templateRef" JSONB NOT NULL,
    stage VARCHAR(32) NOT NULL DEFAULT 'staged',
    "deploymentCommandId" UUID NOT NULL,
    "activeSessionId" UUID,
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "currentTurnIndex" INTEGER NOT NULL DEFAULT 0,
    "activeWaveIndex" INTEGER NOT NULL DEFAULT 0,
    participants JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encounter_runs_campaign ON encounter_runs("campaignId");
CREATE INDEX IF NOT EXISTS idx_encounter_runs_stage ON encounter_runs(stage);

-- Campaign Studio authored objects and immutable revisions
CREATE TABLE IF NOT EXISTS campaign_objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "campaignId" UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL CHECK (kind IN (
        'note', 'npc', 'location', 'faction', 'quest', 'lore', 'clue',
        'scene-template', 'campaign-map', 'session-plan'
    )),
    title VARCHAR(255) NOT NULL,
    "currentRevision" INTEGER NOT NULL DEFAULT 1 CHECK ("currentRevision" >= 1),
    status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'ready', 'retired', 'archived'
    )),
    "createdBy" UUID REFERENCES users(id) ON DELETE SET NULL,
    "updatedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_objects_campaign ON campaign_objects("campaignId");
CREATE INDEX IF NOT EXISTS idx_campaign_objects_campaign_kind ON campaign_objects("campaignId", kind);
CREATE INDEX IF NOT EXISTS idx_campaign_objects_campaign_status ON campaign_objects("campaignId", status);

CREATE TABLE IF NOT EXISTS campaign_object_revisions (
    "objectId" UUID NOT NULL REFERENCES campaign_objects(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    "schemaVersion" INTEGER NOT NULL CHECK ("schemaVersion" >= 1),
    data JSONB NOT NULL,
    "dependencyManifest" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdBy" UUID REFERENCES users(id) ON DELETE SET NULL,
    "requestId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("objectId", revision)
);

CREATE INDEX IF NOT EXISTS idx_campaign_object_revisions_request ON campaign_object_revisions("requestId");

CREATE TABLE IF NOT EXISTS campaign_object_links (
    "sourceObjectId" UUID NOT NULL,
    "sourceRevision" INTEGER NOT NULL,
    "targetKey" TEXT NOT NULL,
    target JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("sourceObjectId", "sourceRevision", "targetKey"),
    FOREIGN KEY ("sourceObjectId", "sourceRevision")
        REFERENCES campaign_object_revisions("objectId", revision)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campaign_object_links_target ON campaign_object_links("targetKey");

CREATE TRIGGER update_campaign_actors_updated_at BEFORE UPDATE ON campaign_actors FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_library_objects_updated_at BEFORE UPDATE ON library_objects FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_encounter_runs_updated_at BEFORE UPDATE ON encounter_runs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_campaign_objects_updated_at BEFORE UPDATE ON campaign_objects FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Session plan activations linking published session plans into live VTT sessions
CREATE TABLE IF NOT EXISTS session_plan_activations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "campaignId" UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    "sessionPlanId" UUID NOT NULL REFERENCES campaign_objects(id) ON DELETE CASCADE,
    "planRevision" INTEGER NOT NULL CHECK ("planRevision" >= 1),
    "sessionId" VARCHAR(64) NOT NULL,
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0 CHECK ("currentStepIndex" >= 0),
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    "stepStates" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "activatedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_plan_activations_campaign ON session_plan_activations("campaignId");
CREATE INDEX IF NOT EXISTS idx_session_plan_activations_session_plan ON session_plan_activations("sessionPlanId");
CREATE INDEX IF NOT EXISTS idx_session_plan_activations_session ON session_plan_activations("sessionId");
CREATE INDEX IF NOT EXISTS idx_session_plan_activations_status ON session_plan_activations("status");

CREATE TRIGGER update_session_plan_activations_updated_at BEFORE UPDATE ON session_plan_activations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
