-- Widen the Campaign Studio object kind check for sessions, acts, encounters
-- and party members. Additive: every existing row stays valid.

ALTER TABLE campaign_objects
    DROP CONSTRAINT IF EXISTS campaign_objects_kind_check;

ALTER TABLE campaign_objects
    ADD CONSTRAINT campaign_objects_kind_check CHECK (kind IN (
        'note', 'npc', 'location', 'faction', 'quest', 'lore', 'clue',
        'session', 'act', 'encounter', 'party-member',
        'scene-template', 'campaign-map', 'session-plan'
    ));
