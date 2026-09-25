-- Add canonical, versioned Campaign Studio preparation storage.

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

CREATE INDEX IF NOT EXISTS idx_campaign_objects_campaign
    ON campaign_objects("campaignId");
CREATE INDEX IF NOT EXISTS idx_campaign_objects_campaign_kind
    ON campaign_objects("campaignId", kind);
CREATE INDEX IF NOT EXISTS idx_campaign_objects_campaign_status
    ON campaign_objects("campaignId", status);

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

CREATE INDEX IF NOT EXISTS idx_campaign_object_revisions_request
    ON campaign_object_revisions("requestId");

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

CREATE INDEX IF NOT EXISTS idx_campaign_object_links_target
    ON campaign_object_links("targetKey");

DROP TRIGGER IF EXISTS update_campaign_objects_updated_at ON campaign_objects;
CREATE TRIGGER update_campaign_objects_updated_at
    BEFORE UPDATE ON campaign_objects
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
