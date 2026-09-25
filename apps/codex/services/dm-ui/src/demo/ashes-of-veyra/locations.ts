import type { CampaignLocation } from './types';

export const locations: CampaignLocation[] = [
  {
    id: 'location-glass-harbor',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Glass Harbor',
    type: 'district',
    shortDescription:
      'A bright, crowded trade city built above the drowned royal quarter.',
    description: [
      'Salt haze turns the glass roofs silver at dawn. Every quay has its own customs and its own quiet arrangement.',
      'The old tide line runs through cellars and foundations where the city has been built over Veyra stone.',
    ],
    tags: ['City', 'Trade', 'Harbor'],
    mapId: 'map-glass-harbor',
    pinId: 'pin-north-docks',
    npcIds: ['npc-captain-serin', 'npc-oren-voss'],
    factionIds: [
      'faction-harbor-watch',
      'faction-ashen-synod',
      'faction-lantern-guild',
    ],
    encounterIds: [
      'encounter-dockside-ambush',
      'encounter-city-watch-checkpoint',
    ],
    questIds: ['quest-find-ember-key', 'quest-fractured-spire'],
    handoutIds: ['lore-azure-compact'],
    notes:
      'The city selector region; use district records for specific scenes and encounters.',
  },
  {
    id: 'location-north-docks',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'North Docks',
    type: 'pier',
    shortDescription:
      'A maze of working piers where the Dawn Petrel first entered the harbor.',
    description: [
      'Crane crews unload before sunrise while brokers trade berth numbers over fish crates.',
      'The Lantern Guild maintains a brass tide gauge at the outer breakwater.',
    ],
    tags: ['Docks', 'Shipping', 'Crimson Wake'],
    mapId: 'map-glass-harbor',
    pinId: 'pin-north-docks',
    npcIds: ['npc-selka-marr', 'npc-neris-quill'],
    factionIds: ['faction-crimson-wake', 'faction-lantern-guild'],
    encounterIds: ['encounter-dockside-ambush', 'encounter-sahuagin-patrol'],
    questIds: ['quest-find-ember-key', 'quest-a-debt-in-blood'],
    handoutIds: ['handout-burned-shipping-ledger'],
    notes:
      'The Dawn Petrel berth is recorded in a manifest whose surviving copy is badly burned.',
  },
  {
    id: 'location-salty-mast',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'The Salty Mast Tavern',
    type: 'tavern',
    shortDescription:
      'A dockside refuge where Mara trades a hot meal for a useful truth.',
    description: [
      'The floor pitches gently toward a drain that predates the building.',
      'Mara Venn can put a name to almost every sailor in the harbor and dislikes the Watch asking after her guests.',
    ],
    tags: ['Tavern', 'Rumors', 'Safe House'],
    mapId: 'map-glass-harbor',
    pinId: 'pin-salty-mast',
    npcIds: ['npc-mara-venn', 'npc-selka-marr'],
    factionIds: ['faction-crimson-wake', 'faction-choir-below'],
    encounterIds: ['encounter-drowned-cellar'],
    questIds: ['quest-a-debt-in-blood', 'quest-whispers-beneath-veyra'],
    handoutIds: ['lore-bell-rhyme-shoals'],
    sceneTemplateId: 'scene-salty-mast-cellar',
    notes: 'The cellar grate is safest to inspect at low tide.',
  },
  {
    id: 'location-fishmongers-row',
    campaignId: 'campaign-ashes-of-veyra',
    name: "Fishmongers' Row",
    type: 'market',
    shortDescription:
      'A narrow market lane still blackened from the attempted ledger fire.',
    description: [
      'Canvas awnings trap brine and smoke above the stalls. Neighbors have already rebuilt the fish tables.',
      'An ash mark on a crate survived the fire better than the ink around it.',
    ],
    tags: ['Market', 'Fire', 'Evidence'],
    mapId: 'map-glass-harbor',
    pinId: 'pin-fishmongers-row',
    npcIds: ['npc-captain-serin', 'npc-neris-quill'],
    factionIds: ['faction-harbor-watch', 'faction-lantern-guild'],
    encounterIds: ['encounter-city-watch-checkpoint'],
    questIds: ['quest-find-ember-key'],
    handoutIds: ['handout-burned-shipping-ledger'],
    notes:
      'Session 11 fire was contained before it reached the adjoining chandlery.',
  },
  {
    id: 'location-old-customs-house',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Old Customs House',
    type: 'government',
    shortDescription:
      'A stone customs office whose lower foundation predates the modern harbor.',
    description: [
      'Salt has eaten the bronze fittings, but the upper offices still process cargo warrants.',
      'A sealed stair beneath the record vault descends toward a flooded passage marked in pre-Veyran script.',
    ],
    tags: ['Government', 'Harbor', 'Law Enforcement'],
    mapId: 'map-glass-harbor',
    pinId: 'pin-old-customs-house',
    npcIds: ['npc-captain-serin', 'npc-elian-rook', 'npc-oren-voss'],
    factionIds: [
      'faction-harbor-watch',
      'faction-ashen-synod',
      'faction-choir-below',
    ],
    encounterIds: ['encounter-city-watch-checkpoint'],
    questIds: ['quest-find-ember-key', 'quest-whispers-beneath-veyra'],
    handoutIds: ['handout-harbormasters-warning', 'lore-azure-compact'],
    sceneTemplateId: 'scene-harbor-warehouse-template',
    imagePath: '/demo/ashes-of-veyra/glass-harbor-map.png',
    notes:
      'Captain Serin can grant access to the public records room; the lower stair is unlisted.',
  },
  {
    id: 'location-harbor-warehouse',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Harbor Warehouse',
    type: 'landmark',
    shortDescription:
      'A bonded warehouse where the Dawn Petrel cargo was relabeled before inspection.',
    description: [
      'Tall shuttered bays open onto a narrow service quay. Chalk tally marks cover the inner door.',
      'One crate bears the combined ash script and drowned royal seal seen on the ledger fragment.',
    ],
    tags: ['Warehouse', 'Cargo', 'Ember Key'],
    mapId: 'map-glass-harbor',
    pinId: 'pin-harbor-warehouse',
    npcIds: ['npc-selka-marr', 'npc-elian-rook'],
    factionIds: ['faction-crimson-wake', 'faction-harbor-watch'],
    encounterIds: ['encounter-dockside-ambush'],
    questIds: ['quest-find-ember-key'],
    handoutIds: ['handout-burned-shipping-ledger'],
    sceneTemplateId: 'scene-harbor-warehouse-template',
    notes:
      'The ledger lists the shipment under kiln glass to conceal its weight.',
  },
  {
    id: 'location-south-pier',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'South Pier',
    type: 'pier',
    shortDescription:
      'An eastern-facing pier with a rusted chain gate and a deep-water drop.',
    description: [
      'The Watch changes shift here at dusk, leaving a brief gap in the lantern patrol.',
      'At low tide a submerged arch is visible below the outer pilings; sailors say it answers the third bell.',
    ],
    tags: ['Pier', 'Eastern Harbor', 'Ambush Site'],
    mapId: 'map-glass-harbor',
    pinId: 'pin-south-pier',
    npcIds: ['npc-captain-serin', 'npc-elian-rook'],
    factionIds: ['faction-harbor-watch', 'faction-choir-below'],
    encounterIds: ['encounter-dockside-ambush', 'encounter-sahuagin-patrol'],
    questIds: ['quest-find-ember-key', 'quest-whispers-beneath-veyra'],
    handoutIds: [
      'handout-harbormasters-warning',
      'handout-burned-shipping-ledger',
    ],
    notes:
      'The intended Session 12 rendezvous is on the east chain side of the pier.',
  },
];
