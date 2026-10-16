-- Campaign-scoped items (loot and treasure). Additive.

ALTER TABLE campaign_objects
    DROP CONSTRAINT IF EXISTS campaign_objects_kind_check;

ALTER TABLE campaign_objects
    ADD CONSTRAINT campaign_objects_kind_check CHECK (kind IN (
        'note', 'npc', 'location', 'faction', 'quest', 'lore', 'clue',
        'session', 'act', 'encounter', 'party-member', 'homebrew-monster', 'item',
        'scene-template', 'campaign-map', 'session-plan'
    ));
