-- Campaign Studio extensions: campaign edition/mode/mood, studio prep kinds, and entity pins. Additive.

ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS "edition" VARCHAR(16) NOT NULL DEFAULT '2024',
    ADD COLUMN IF NOT EXISTS "mode" VARCHAR(32) NOT NULL DEFAULT 'campaign',
    ADD COLUMN IF NOT EXISTS "mood" VARCHAR(64);

ALTER TABLE campaign_objects
    DROP CONSTRAINT IF EXISTS campaign_objects_kind_check;

ALTER TABLE campaign_objects
    ADD CONSTRAINT campaign_objects_kind_check CHECK (kind IN (
        'note', 'npc', 'location', 'faction', 'quest', 'lore', 'clue',
        'session', 'act', 'encounter', 'party-member', 'homebrew-monster', 'item',
        'scene-template', 'campaign-map', 'session-plan',
        'secret', 'inbox-note', 'custom-creature'
    ));

CREATE TABLE IF NOT EXISTS campaign_object_pins (
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "objectId" UUID NOT NULL REFERENCES campaign_objects(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("userId", "objectId")
);

CREATE INDEX IF NOT EXISTS idx_campaign_object_pins_user
    ON campaign_object_pins("userId");
