import type { CampaignAct, CampaignFixture } from '../ashes-of-veyra/types';

export const KHARAD_CAMPAIGN_ID = 'campaign-stars-below-kharad';
export const KHARAD_ACT_ONE_ID = `${KHARAD_CAMPAIGN_ID}-act-1`;
export const KHARAD_ACT_EPILOGUE_ID = `${KHARAD_CAMPAIGN_ID}-act-epilogue`;
export const KHARAD_SESSION_1_ID = `${KHARAD_CAMPAIGN_ID}-session-1`;
export const KHARAD_SESSION_2_ID = `${KHARAD_CAMPAIGN_ID}-session-2`;
export const KHARAD_SESSION_3_ID = `${KHARAD_CAMPAIGN_ID}-session-3`;

/** A finished campaign. */
export type KharadCampaignFixture = CampaignFixture & {
  status: 'complete';
};

export const kharadActs: CampaignAct[] = [
  {
    id: KHARAD_ACT_ONE_ID,
    campaignId: KHARAD_CAMPAIGN_ID,
    title: 'Act I: The Buried Constellation',
    order: 1,
    status: 'complete',
    firstSessionNumber: 1,
    lastSessionNumber: 3,
    summary:
      'A mine collapse exposes an inverted observatory. The party reads its chart, binds seven rival holds to a fragile peace, and outruns a rival expedition to the star engine at the heart of the constellation.',
  },
  {
    id: KHARAD_ACT_EPILOGUE_ID,
    campaignId: KHARAD_CAMPAIGN_ID,
    title: 'Epilogue: Under a Changed Sky',
    order: 2,
    status: 'complete',
    firstSessionNumber: 3,
    lastSessionNumber: 3,
    summary:
      'The vessel is kindled into a deep sun, the promises to the seven holds are tallied, and each hero decides what to build now that the holds must share a future.',
  },
];

export const kharadCampaign: KharadCampaignFixture = {
  id: KHARAD_CAMPAIGN_ID,
  title: 'Stars Below Kharad',
  subtitle: 'The oldest road points down, beyond stone and sky.',
  premise:
    'A mine collapse reveals an observatory aimed into the earth and a star engine linking seven rival holds. The heroes race to understand the machine before political ambition wakes its ancient custodian and turns a buried vessel into a weapon.',
  ruleset: 'D&D 5e',
  edition: '2014 campaign for levels 9-10; custom guardian and void creatures are marked per encounter',
  status: 'complete',
  currentSessionId: KHARAD_SESSION_3_ID,
  actIds: kharadActs.map((act) => act.id),
  sessionIds: [KHARAD_SESSION_1_ID, KHARAD_SESSION_2_ID, KHARAD_SESSION_3_ID],
  playerCharacters: [
    {
      id: `${KHARAD_CAMPAIGN_ID}-pc-dagna`,
      name: 'Dagna Seven-Chalks',
      ancestry: 'Dwarf',
      className: 'Wizard',
      level: 10,
      hook: 'Her academic disgrace began with a correct theory about the deep sky. She now holds the first seat of the Commons and keeps her original paper framed in the Chalk Gallery, one word chalked beneath it: “Right.” Orla Silvervein has noticed she is the only custodian the engine will answer to.',
    },
    {
      id: `${KHARAD_CAMPAIGN_ID}-pc-orik`,
      name: 'Orik Vaul',
      ancestry: 'Goliath',
      className: 'Fighter',
      level: 10,
      hook: 'Carries a survey hammer that vibrates near the buried transit line. He stood the final beam at the Singing Fault with eleven lives under it, and guards the Commons gate now by choice. The hammer still hums a half-step flat near the sealed Eighth Shaft.',
    },
    {
      id: `${KHARAD_CAMPAIGN_ID}-pc-nima`,
      name: 'Nima Ashglass',
      ancestry: 'Deep gnome',
      className: 'Artificer',
      level: 10,
      hook: 'Inherited one key to the engine and a warning never to use it. She sealed it in the deep sun’s casing, and her great-uncle Fennick has just arrived with a letter saying the Ashglass keys were cut as a pair. The spare tuning fork in her pocket sings whenever she passes the Highvein counting house.',
    },
    {
      id: `${KHARAD_CAMPAIGN_ID}-pc-hale`,
      name: 'Hale-of-Echoes',
      ancestry: 'Orc',
      className: 'Cleric',
      level: 10,
      hook: 'Believes the constellation is a map left by their god. Hale tends the evening bell shrine with Echo-Prior Gruvna and quietly wonders whether a map can have a second page. The sleeper berths felt warm under their hand, and no one else seems troubled by that.',
    },
  ],
  // Literal counts; kept honest by fixtures.test.ts.
  objectCounts: {
    all: 113,
    scenes: 16,
    encounters: 14,
    npcs: 17,
    lore: 7,
    handouts: 16,
  },
  nextSession: {
    sessionId: KHARAD_SESSION_3_ID,
    plannedDate: 'Sat, May 30, 2026',
    time: 'Concluded',
    relativeDate: 'campaign complete',
    encounterId: 'encounter-fate-of-the-vessel',
    npcId: 'npc-the-astronomer',
    locationId: 'location-engine-heart',
    questId: 'quest-honor-the-seven-promises',
  },
  activity: {
    backlinks: [
      {
        id: 'backlink-the-astronomer',
        label: 'The Astronomer',
        objectType: 'npc',
        targetId: 'npc-the-astronomer',
        detail: 'Guardian surrendered in Session 3',
      },
      {
        id: 'backlink-engine-heart',
        label: 'The Engine Heart',
        objectType: 'location',
        targetId: 'location-engine-heart',
        detail: 'Now a deep sun; the eighth shaft lies beneath it',
      },
      {
        id: 'backlink-fate-of-the-vessel',
        label: 'The Fate of the Vessel',
        objectType: 'encounter',
        targetId: 'encounter-fate-of-the-vessel',
        detail: 'Resolved: kindled, not launched',
      },
      {
        id: 'backlink-seven-promises',
        label: 'Honor the Seven Promises',
        objectType: 'quest',
        targetId: 'quest-honor-the-seven-promises',
        detail: 'Closed with one broken promise',
      },
      {
        id: 'backlink-hold-highvein',
        label: 'Hold Highvein',
        objectType: 'faction',
        targetId: 'faction-hold-highvein',
        detail: 'Referenced by the open toll-war and second-key threads',
      },
      {
        id: 'backlink-eighth-light',
        label: 'The Eighth Light',
        objectType: 'quest',
        targetId: 'quest-the-eighth-light',
        detail: 'Sequel hook on hold; linked to the empty berths and the chart',
      },
      {
        id: 'backlink-orla-silvervein',
        label: 'Banker-Delegate Orla Silvervein',
        objectType: 'npc',
        targetId: 'npc-orla-silvervein',
        detail: 'Appears in Sessions 2 and 3; sent an epilogue letter',
      },
    ],
    recentEdits: [
      {
        id: 'edit-legacy-of-kharad',
        label: 'The Seven Holds',
        objectType: 'faction',
        targetId: 'faction-seven-hold-concord',
        detail: 'Faction · Epilogue archived',
      },
      {
        id: 'edit-commons',
        label: 'The Commons of Seven Chalks',
        objectType: 'location',
        targetId: 'location-kharad-commons',
        detail: 'Location · Epilogue archived',
      },
      {
        id: 'edit-fate-of-the-vessel',
        label: 'The Fate of the Vessel',
        objectType: 'encounter',
        targetId: 'encounter-fate-of-the-vessel',
        detail: 'Encounter · Outcome recorded',
      },
      {
        id: 'edit-honor-promises',
        label: 'Honor the Seven Promises',
        objectType: 'quest',
        targetId: 'quest-honor-the-seven-promises',
        detail: 'Quest · Closed out',
      },
      {
        id: 'edit-constellation-map',
        label: 'Map: The Buried Constellation',
        objectType: 'map',
        targetId: 'map-buried-constellation',
        detail: 'Map · Final annotations saved',
      },
      {
        id: 'edit-turn-the-tolls',
        label: 'Turn the Tolls',
        objectType: 'quest',
        targetId: 'quest-turn-the-tolls',
        detail: 'Quest · Put on hold with the toll ledger attached',
      },
      {
        id: 'edit-counting-house',
        label: 'The Highvein Counting House',
        objectType: 'location',
        targetId: 'location-highvein-counting-house',
        detail: 'Location · Sealed back doors noted as a sequel hook',
      },
      {
        id: 'edit-berth-galleries',
        label: 'The Berth Galleries',
        objectType: 'location',
        targetId: 'location-berth-galleries',
        detail: 'Location · Empty-berth count updated',
      },
    ],
  },
};
