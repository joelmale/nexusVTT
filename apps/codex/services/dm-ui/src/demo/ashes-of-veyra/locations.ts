import type { CampaignLocation } from './types';

const CAMPAIGN_ID = 'campaign-ashes-of-veyra';

export const locations: CampaignLocation[] = [
  {
    id: 'location-glass-harbor',
    campaignId: CAMPAIGN_ID,
    name: 'Glass Harbor',
    type: 'district',
    shortDescription:
      'A bright, crowded trade city built above the drowned royal quarter.',
    description: [
      'Salt haze turns the glass roofs silver at dawn. Every quay has its own customs and its own quiet arrangement.',
      'The old tide line runs through cellars and foundations where the city has been built over Veyra stone.',
      'Four powers share the waterfront without ever agreeing to: the Watch holds the chain, the Concord holds the debts, the Synod holds the dead, and the Wake holds everything that moves after dark. Visitors learn quickly which bell tolls for which.',
    ],
    tags: ['City', 'Trade', 'Harbor'],
    mapId: 'map-glass-harbor',
    pinId: 'pin-north-docks',
    npcIds: [
      'npc-captain-serin',
      'npc-oren-voss',
      'npc-halden-brask',
      'npc-inspector-vane',
    ],
    factionIds: [
      'faction-harbor-watch',
      'faction-ashen-synod',
      'faction-lantern-guild',
      'faction-gilded-concord',
    ],
    encounterIds: [
      'encounter-dockside-ambush',
      'encounter-city-watch-checkpoint',
    ],
    questIds: [
      'quest-find-ember-key',
      'quest-fractured-spire',
      'quest-passage-to-veyra',
    ],
    handoutIds: [
      'lore-azure-compact',
      'handout-harbor-map-legend',
      'lore-sinking-of-veyra',
    ],
    notes:
      'The city selector region; use district records for specific scenes and encounters. Weather and tide are the pacing tools: low tide opens the south arch and the cellar grates.',
  },
  {
    id: 'location-north-docks',
    campaignId: CAMPAIGN_ID,
    name: 'North Docks',
    type: 'pier',
    parentLocationId: 'location-glass-harbor',
    shortDescription:
      'A maze of working piers where the Dawn Petrel first entered the harbor.',
    description: [
      'Crane crews unload before sunrise while brokers trade berth numbers over fish crates.',
      'The Lantern Guild maintains a brass tide gauge at the outer breakwater.',
      'Selka Marr keeps no office. Her business is conducted on benches, in boat cabins and at whichever stall is selling the best eels that morning.',
    ],
    tags: ['Docks', 'Shipping', 'Crimson Wake'],
    mapId: 'map-glass-harbor',
    pinId: 'pin-north-docks',
    npcIds: [
      'npc-selka-marr',
      'npc-neris-quill',
      'npc-kestrel-ruhn',
      'npc-hesper-dray',
    ],
    factionIds: ['faction-crimson-wake', 'faction-lantern-guild'],
    encounterIds: [
      'encounter-dockside-ambush',
      'encounter-sahuagin-patrol',
      'encounter-crimson-wake-parley',
    ],
    questIds: ['quest-find-ember-key', 'quest-a-debt-in-blood'],
    handoutIds: [
      'handout-burned-shipping-ledger',
      'handout-crimson-wake-debt-note',
    ],
    notes:
      'The Dawn Petrel berth is recorded in a manifest whose surviving copy is badly burned. Captain Dray was last seen leaving by the long gangway at third bell.',
  },
  {
    id: 'location-salty-mast',
    campaignId: CAMPAIGN_ID,
    name: 'The Salty Mast Tavern',
    type: 'tavern',
    parentLocationId: 'location-glass-harbor',
    shortDescription:
      'A dockside refuge where Mara trades a hot meal for a useful truth.',
    description: [
      'The floor pitches gently toward a drain that predates the building.',
      'Mara Venn can put a name to almost every sailor in the harbor and dislikes the Watch asking after her guests.',
      'Beneath the kitchen a cellar runs down to a tide grate. At low tide a cold draught carries a faint knocking up through the floorboards, which Mara explains as "pipes."',
    ],
    tags: ['Tavern', 'Rumors', 'Safe House'],
    mapId: 'map-glass-harbor',
    pinId: 'pin-salty-mast',
    npcIds: [
      'npc-mara-venn',
      'npc-selka-marr',
      'npc-pell-thistlewick',
      'npc-brother-tamsin',
    ],
    factionIds: ['faction-crimson-wake', 'faction-choir-below'],
    encounterIds: [
      'encounter-drowned-cellar',
      'encounter-crimson-wake-parley',
    ],
    questIds: [
      'quest-a-debt-in-blood',
      'quest-whispers-beneath-veyra',
      'quest-ash-and-ink',
    ],
    handoutIds: [
      'lore-bell-rhyme-shoals',
      'handout-salty-mast-rumors',
      'handout-tamsin-confession',
    ],
    sceneTemplateId: 'scene-salty-mast-cellar',
    notes:
      'The cellar grate is safest to inspect at low tide. Mara will shelter anyone who asks and will not give them up, but she will tell the party first.',
  },
  {
    id: 'location-fishmongers-row',
    campaignId: CAMPAIGN_ID,
    name: "Fishmongers' Row",
    type: 'market',
    parentLocationId: 'location-glass-harbor',
    shortDescription:
      'A narrow market lane still blackened from the attempted ledger fire.',
    description: [
      'Canvas awnings trap brine and smoke above the stalls. Neighbors have already rebuilt the fish tables.',
      'An ash mark on a crate survived the fire better than the ink around it.',
      'Locals have started leaving a lantern at the burned stall each night. Nobody admits to it, and the Watch has stopped removing them.',
    ],
    tags: ['Market', 'Fire', 'Evidence'],
    mapId: 'map-glass-harbor',
    pinId: 'pin-fishmongers-row',
    npcIds: [
      'npc-captain-serin',
      'npc-neris-quill',
      'npc-pell-thistlewick',
      'npc-dagan-corr',
    ],
    factionIds: ['faction-harbor-watch', 'faction-lantern-guild'],
    encounterIds: [
      'encounter-city-watch-checkpoint',
      'encounter-warehouse-fire',
    ],
    questIds: ['quest-find-ember-key', 'quest-clear-kaels-name'],
    handoutIds: ['handout-burned-shipping-ledger'],
    notes:
      'Session 11 fire was contained before it reached the adjoining chandlery. Pell Thistlewick works the row and saw who soaked the awnings.',
  },
  {
    id: 'location-old-customs-house',
    campaignId: CAMPAIGN_ID,
    name: 'Old Customs House',
    type: 'government',
    parentLocationId: 'location-glass-harbor',
    shortDescription:
      'A stone customs office whose lower foundation predates the modern harbor.',
    description: [
      'Salt has eaten the bronze fittings, but the upper offices still process cargo warrants.',
      'A sealed stair beneath the record vault descends toward a flooded passage marked in pre-Veyran script.',
      'The vault clerks work by lamplight and refuse to discuss the cold that rises from the stair. Three have requested transfers since the Dawn Petrel arrived.',
    ],
    tags: ['Government', 'Harbor', 'Law Enforcement'],
    mapId: 'map-glass-harbor',
    pinId: 'pin-old-customs-house',
    npcIds: [
      'npc-captain-serin',
      'npc-elian-rook',
      'npc-oren-voss',
      'npc-inspector-vane',
      'npc-dagan-corr',
    ],
    factionIds: [
      'faction-harbor-watch',
      'faction-ashen-synod',
      'faction-choir-below',
    ],
    encounterIds: [
      'encounter-city-watch-checkpoint',
      'encounter-rook-confrontation',
    ],
    questIds: [
      'quest-find-ember-key',
      'quest-whispers-beneath-veyra',
      'quest-clear-kaels-name',
    ],
    handoutIds: [
      'handout-harbormasters-warning',
      'lore-azure-compact',
      'handout-kael-dismissal-order',
    ],
    sceneTemplateId: 'scene-harbor-warehouse-template',
    imagePath: '/demo/ashes-of-veyra/glass-harbor-map.png',
    notes:
      'Captain Serin can grant access to the public records room; the lower stair is unlisted. The record vault holds the original crew rolls and the muster ledger Kael needs.',
  },
  {
    id: 'location-harbor-warehouse',
    campaignId: CAMPAIGN_ID,
    name: 'Harbor Warehouse',
    type: 'landmark',
    parentLocationId: 'location-glass-harbor',
    shortDescription:
      'A bonded warehouse where the Dawn Petrel cargo was relabeled before inspection.',
    description: [
      'Tall shuttered bays open onto a narrow service quay. Chalk tally marks cover the inner door.',
      'One crate bears the combined ash script and drowned royal seal seen on the ledger fragment.',
      'The warehouse is leased through three shell companies; the Crimson Wake pays the rent, the Watch holds the keys, and a Concord clerk signs the insurance.',
    ],
    tags: ['Warehouse', 'Cargo', 'Ember Key'],
    mapId: 'map-glass-harbor',
    pinId: 'pin-harbor-warehouse',
    npcIds: ['npc-selka-marr', 'npc-elian-rook', 'npc-kestrel-ruhn'],
    factionIds: ['faction-crimson-wake', 'faction-harbor-watch'],
    encounterIds: ['encounter-dockside-ambush'],
    questIds: ['quest-find-ember-key'],
    handoutIds: [
      'handout-burned-shipping-ledger',
      'handout-port-authority-writ',
    ],
    sceneTemplateId: 'scene-harbor-warehouse-template',
    notes:
      'The ledger lists the shipment under kiln glass to conceal its weight. The party can still find sawdust in the hold that does not match any listed cargo.',
  },
  {
    id: 'location-south-pier',
    campaignId: CAMPAIGN_ID,
    name: 'South Pier',
    type: 'pier',
    parentLocationId: 'location-glass-harbor',
    shortDescription:
      'An eastern-facing pier with a rusted chain gate and a deep-water drop.',
    description: [
      'The Watch changes shift here at dusk, leaving a brief gap in the lantern patrol.',
      'At low tide a submerged arch is visible below the outer pilings; sailors say it answers the third bell.',
      'Barnacled mooring rings line the east chain, and the water between them stays glassy even in a stiff wind. Children dare each other to touch the arch with a fishing pole.',
    ],
    tags: ['Pier', 'Eastern Harbor', 'Ambush Site'],
    mapId: 'map-glass-harbor',
    pinId: 'pin-south-pier',
    npcIds: [
      'npc-captain-serin',
      'npc-elian-rook',
      'npc-kestrel-ruhn',
      'npc-hesper-dray',
    ],
    factionIds: [
      'faction-harbor-watch',
      'faction-choir-below',
      'faction-sunken-reach',
    ],
    encounterIds: ['encounter-dockside-ambush', 'encounter-sahuagin-patrol'],
    questIds: [
      'quest-find-ember-key',
      'quest-whispers-beneath-veyra',
    ],
    handoutIds: [
      'handout-harbormasters-warning',
      'handout-burned-shipping-ledger',
      'handout-unsigned-letter-pier6',
    ],
    notes:
      'The intended Session 12 rendezvous is on the east chain side of the pier. At the lowest ebb the arch is a doorway, not an ornament.',
  },
  {
    id: 'location-veyra-coast',
    campaignId: CAMPAIGN_ID,
    name: 'The Veyra Coast',
    type: 'region',
    parentLocationId: 'location-glass-harbor',
    shortDescription:
      'A windswept shore of cliffs, shoals and lantern-lit roads outside Glass Harbor.',
    description: [
      'The coast runs for forty miles between the Black Shoals and the harbor mouth. Fishing hamlets cling to every inlet, and every one of them has a story about the bells.',
      'The Lantern Road follows the cliff tops, marked by iron lamp posts the Guild maintains. After dark the road is the only safe way to travel; the shoreline is a different country.',
    ],
    tags: ['Region', 'Coastal', 'Act I'],
    npcIds: ['npc-neris-quill', 'npc-mara-venn'],
    factionIds: ['faction-lantern-guild', 'faction-sunken-reach'],
    encounterIds: [],
    questIds: [
      'quest-survive-the-shoals',
      'quest-lantern-road-escort',
      'quest-passage-to-veyra',
    ],
    handoutIds: ['handout-lantern-writ-of-passage'],
    notes:
      'Covers Act I travel. The coast is a good place to run flashbacks or bridging scenes when the harbor needs a breather.',
  },
  {
    id: 'location-black-shoals',
    campaignId: CAMPAIGN_ID,
    name: 'The Black Shoals',
    type: 'landmark',
    parentLocationId: 'location-veyra-coast',
    shortDescription:
      'A field of jagged reefs where the Northstar broke apart and the sahuagin watch the tide.',
    description: [
      'The shoals take their name from the volcanic glass that glitters just under the waterline. At low tide the whole field looks like a broken mirror.',
      'The wreck of the Northstar lies on her side near the western reef, her mast like a finger pointing at the shore. Sahuagin tracks circle the wreck and lead toward a tidal cave the party has not yet entered.',
    ],
    tags: ['Wreck', 'Act I', 'Sahuagin'],
    npcIds: ['npc-ysolde-marrow'],
    factionIds: ['faction-sunken-reach', 'faction-choir-below'],
    encounterIds: ['encounter-wreck-scavengers', 'encounter-shoal-tracks'],
    questIds: ['quest-survive-the-shoals'],
    handoutIds: [
      'handout-northstar-captains-log',
      'lore-sinking-of-veyra',
    ],
    notes:
      'Revisit in Act III: the tidal cave is a back door to the vault approach, and the sahuagin baron holds court there.',
  },
  {
    id: 'location-lantern-waystation',
    campaignId: CAMPAIGN_ID,
    name: 'Lantern Waystation',
    type: 'inn',
    parentLocationId: 'location-veyra-coast',
    shortDescription:
      'A Guild waystation on the Lantern Road that sheltered the shipwreck refugees.',
    description: [
      'A squat stone house with a lamp tower, a stable and a long common room that smells of wet wool and lamp oil. Neris Quill keeps a desk in the loft.',
      'The walls are lined with Guild survey charts, many of them marked with a small red bell. The refugees who stayed here still leave small offerings at the lamp tower.',
    ],
    tags: ['Guild', 'Act I', 'Safe House'],
    npcIds: ['npc-neris-quill'],
    factionIds: ['faction-lantern-guild'],
    encounterIds: [],
    questIds: ['quest-lantern-road-escort'],
    handoutIds: [],
    notes:
      'The waystation is the Guild safe house for the party if Glass Harbor turns hostile. Neris keeps spare writs here.',
  },
  {
    id: 'location-fractured-spire',
    campaignId: CAMPAIGN_ID,
    name: 'The Fractured Spire',
    type: 'ruin',
    parentLocationId: 'location-veyra-coast',
    shortDescription:
      'A cracked pre-Veyran observatory whose great lens has vanished from its mount.',
    description: [
      'The spire rises from a bare headland, split from apex to foundation by a seam of blue light that does not fade. Inside, brass instruments hang in silent orbits.',
      'The lens mount at the apex is still warm. Wards crawl along the walls in a slow spiral, and the line they trace, if extended across the map, ends at the Old Customs House.',
    ],
    tags: ['Ruin', 'Wards', 'Act I'],
    npcIds: ['npc-neris-quill'],
    factionIds: ['faction-lantern-guild'],
    encounterIds: ['encounter-spire-wards'],
    questIds: ['quest-fractured-spire'],
    handoutIds: ['handout-observatory-journal-page'],
    notes:
      'The keeper hid notes behind the third stone of the stair wall; the party has found only the first page.',
  },
  {
    id: 'location-synod-relief-house',
    campaignId: CAMPAIGN_ID,
    name: 'Ashen Synod Relief House',
    type: 'temple',
    parentLocationId: 'location-glass-harbor',
    shortDescription:
      'A soup-kitchen temple that feeds hundreds of dockside families and quietly forges customs paper.',
    description: [
      'A long hall of grey stone with a vaulted nave and a smoking stove at either end. Each morning four hundred loaves are handed across the front tables, and each night a smaller group meets in the ash-reading room behind the altar.',
      'Prelate Voss keeps a spartan office above the kitchens. Brother Tamsin works in a cell off the scriptorium and has not slept properly in a month.',
    ],
    tags: ['Temple', 'Synod', 'Forgery'],
    npcIds: ['npc-oren-voss', 'npc-brother-tamsin'],
    factionIds: ['faction-ashen-synod'],
    encounterIds: ['encounter-synod-audience'],
    questIds: ['quest-ash-and-ink'],
    handoutIds: ['lore-synod-ash-script', 'handout-tamsin-confession'],
    notes:
      'Sincere charity and sincere conspiracy under one roof. Avoid making the relief house a villain lair; the clergy mostly do not know.',
  },
  {
    id: 'location-counting-hall',
    campaignId: CAMPAIGN_ID,
    name: 'Concord Counting Hall',
    type: 'government',
    parentLocationId: 'location-glass-harbor',
    shortDescription:
      'The marble-fronted headquarters of the Gilded Concord, where harbor debts are written and sold.',
    description: [
      'Clerks in grey coats carry ledgers across a floor of black and white tile. The ceiling is a painted map of the bay with the drowned city sketched beneath the water in gold leaf.',
      'Magister Brask receives visitors in a glass-walled office that overlooks the trading floor. A framed copy of the Azure Compact hangs behind his desk, with one clause underlined.',
    ],
    tags: ['Concord', 'Government', 'Finance'],
    npcIds: ['npc-halden-brask'],
    factionIds: ['faction-gilded-concord'],
    encounterIds: [],
    questIds: ['quest-passage-to-veyra'],
    handoutIds: ['lore-concord-salvage-decree'],
    notes:
      'A good venue for testimony scenes in Act III: Concord clerks keep better records than the Watch and are hungry for scandal.',
  },
  {
    id: 'location-flooded-undercroft',
    campaignId: CAMPAIGN_ID,
    name: 'The Flooded Undercroft',
    type: 'dungeon',
    parentLocationId: 'location-old-customs-house',
    shortDescription:
      'A pre-Veyran passage beneath the Customs House that opens only at low tide.',
    description: [
      'A carved stair descends from the record vault into a cavernous archive half full of black water. Pillars rise from the flood like drowned trees, each marked with a four-bar tide tally.',
      'At the far end an arched door of green-grey metal stands ajar. Behind it is the first of the vault approaches, and the sound of a bell struck by someone who has been waiting a long time.',
    ],
    tags: ['Dungeon', 'Tide', 'Act II finale'],
    npcIds: ['npc-ysolde-marrow'],
    factionIds: ['faction-choir-below', 'faction-ashen-synod'],
    encounterIds: ['encounter-flooded-undercroft'],
    questIds: ['quest-find-ember-key', 'quest-whispers-beneath-veyra'],
    handoutIds: ['lore-bell-rhyme-shoals'],
    notes:
      'Planned for session 13. Run it on a timer: low tide gives roughly one hour before the flood rises past the archive pillars.',
  },
];
