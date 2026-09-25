import type { CampaignAct, CampaignFixture } from './types';

export const CAMPAIGN_ID = 'campaign-ashes-of-veyra';

export const campaignActs: CampaignAct[] = [
  {
    id: 'act-fractured-tides',
    campaignId: CAMPAIGN_ID,
    title: 'Act I: Fractured Tides',
    order: 1,
    status: 'complete',
    firstSessionNumber: 1,
    lastSessionNumber: 7,
    summary:
      'The party survives the wreck of the Northstar, discovers ember-marked cargo, and follows it to Veyra.',
  },
  {
    id: 'act-glass-harbor',
    campaignId: CAMPAIGN_ID,
    title: 'Act II: The Glass Harbor',
    order: 2,
    status: 'active',
    firstSessionNumber: 8,
    lastSessionNumber: 13,
    summary:
      "The party investigates the key's arrival, navigates harbor factions, and uncovers a route beneath the Customs House.",
  },
  {
    id: 'act-hollow-crown',
    campaignId: CAMPAIGN_ID,
    title: 'Act III: The Hollow Crown',
    order: 3,
    status: 'planned',
    firstSessionNumber: 14,
    lastSessionNumber: 20,
    summary:
      'The factions descend into the drowned royal vault while the coast begins to fracture.',
  },
];

export const campaign: CampaignFixture = {
  id: CAMPAIGN_ID,
  title: 'Ashes of Veyra',
  subtitle: 'A fractured realm. A buried truth. And embers that still burn.',
  premise:
    'Veyra is a coastal realm built over the drowned remains of an older kingdom. The Ember Key, believed to unlock the sealed Hollow Crown beneath the bay, has resurfaced in the trade city of Glass Harbor. The party is caught between the Harbor Watch, the Crimson Wake, the Ashen Synod, and a drowned cult that hears voices below the tide.',
  ruleset: 'D&D 5e',
  edition:
    '2024 campaign with compatible 2014 SRD creatures identified per encounter',
  status: 'active',
  currentSessionId: 'session-12',
  actIds: campaignActs.map((act) => act.id),
  sessionIds: Array.from({ length: 13 }, (_, index) => `session-${index + 1}`),
  playerCharacters: [
    {
      id: 'pc-kael-ardyn',
      name: 'Kael Ardyn',
      ancestry: 'Human',
      className: 'Fighter',
      level: 5,
      hook: 'Former Harbor Watch officer seeking who framed him.',
    },
    {
      id: 'pc-mira-vale',
      name: 'Mira Vale',
      ancestry: 'Half-elf',
      className: 'Rogue',
      level: 5,
      hook: 'Her family owes the Crimson Wake a dangerous favor.',
    },
    {
      id: 'pc-torin-stonewake',
      name: 'Torin Stonewake',
      ancestry: 'Dwarf',
      className: 'Cleric',
      level: 5,
      hook: 'Receives visions from bells beneath the bay.',
    },
    {
      id: 'pc-lira-fen',
      name: 'Lira Fen',
      ancestry: 'Elf',
      className: 'Wizard',
      level: 5,
      hook: 'Studies the pre-Veyran wards surrounding the Ember Key.',
    },
  ],
  objectCounts: {
    all: 124,
    scenes: 18,
    encounters: 12,
    npcs: 28,
    lore: 32,
    handouts: 14,
  },
  nextSession: {
    sessionId: 'session-12',
    plannedDate: 'Sat, Apr 26, 2025',
    time: '4-8 PM',
    relativeDate: 'in 3 days',
    encounterId: 'encounter-dockside-ambush',
    npcId: 'npc-captain-serin',
    locationId: 'location-glass-harbor',
    questId: 'quest-find-ember-key',
  },
  activity: {
    backlinks: [
      {
        id: 'backlink-captain-serin',
        label: 'Captain Serin',
        objectType: 'npc',
        targetId: 'npc-captain-serin',
        detail: 'Harbor Master',
      },
      {
        id: 'backlink-glass-harbor',
        label: 'Glass Harbor',
        objectType: 'location',
        targetId: 'location-glass-harbor',
        detail: 'Trade city',
      },
      {
        id: 'backlink-dockside-ambush',
        label: 'Dockside Ambush',
        objectType: 'encounter',
        targetId: 'encounter-dockside-ambush',
        detail: 'Session 12 encounter',
      },
      {
        id: 'backlink-ember-key',
        label: 'Find the Ember Key',
        objectType: 'quest',
        targetId: 'quest-find-ember-key',
        detail: 'High priority',
      },
    ],
    recentEdits: [
      {
        id: 'edit-dockside-ambush',
        label: 'Dockside Ambush',
        objectType: 'encounter',
        targetId: 'encounter-dockside-ambush',
        detail: 'Encounter · 18 minutes ago',
      },
      {
        id: 'edit-captain-serin',
        label: 'Captain Serin',
        objectType: 'npc',
        targetId: 'npc-captain-serin',
        detail: 'NPC · 42 minutes ago',
      },
      {
        id: 'edit-glass-harbor',
        label: 'Glass Harbor',
        objectType: 'location',
        targetId: 'location-glass-harbor',
        detail: 'Location · 1 hour ago',
      },
      {
        id: 'edit-crimson-wake',
        label: 'The Crimson Wake',
        objectType: 'faction',
        targetId: 'faction-crimson-wake',
        detail: 'Faction · Yesterday',
      },
      {
        id: 'edit-harbor-district-map',
        label: 'Map: Harbor District',
        objectType: 'map',
        targetId: 'map-glass-harbor',
        detail: 'Map · Yesterday',
      },
    ],
  },
};
