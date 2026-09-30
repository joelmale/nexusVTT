import type {
  CampaignAct,
  CampaignFixture,
  FixtureId,
} from '../ashes-of-veyra/types';

export const MOURNINGFEN_CAMPAIGN_ID = 'campaign-lanterns-of-mourningfen';

/** Session ids match the campaign-catalog convention. */
export const mourningfenSessionId = (number: number): FixtureId =>
  `${MOURNINGFEN_CAMPAIGN_ID}-session-${number}`;

export const MOURNINGFEN_ACT_1_ID = `${MOURNINGFEN_CAMPAIGN_ID}-act-1`;
export const MOURNINGFEN_ACT_2_ID = `${MOURNINGFEN_CAMPAIGN_ID}-act-2`;
export const MOURNINGFEN_ACT_3_ID = `${MOURNINGFEN_CAMPAIGN_ID}-act-3`;

/** A paused campaign: the shared fixture plus why and since when. */
export type MourningfenCampaignFixture = CampaignFixture & {
  status: 'paused';
  pausedSince: string;
  pauseReason: string;
};

export const campaignActs: CampaignAct[] = [
  {
    id: MOURNINGFEN_ACT_1_ID,
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Act I: What the Fen Kept',
    order: 1,
    status: 'active',
    firstSessionNumber: 1,
    lastSessionNumber: 4,
    summary:
      'The party follows a dead ferryman’s lantern into the marsh, finds the homestead the village erased, and must decide what to do with the well beneath it. Paused after the first session.',
  },
  {
    id: MOURNINGFEN_ACT_2_ID,
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Act II: The Eighth Voice',
    order: 2,
    status: 'planned',
    firstSessionNumber: 5,
    lastSessionNumber: 8,
    summary:
      'Whatever answers from the well begins to reach into the village. The Lantern Wardens close ranks and the drovers threaten to leave the fen for good.',
  },
  {
    id: MOURNINGFEN_ACT_3_ID,
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Act III: The Naming',
    order: 3,
    status: 'planned',
    firstSessionNumber: 9,
    lastSessionNumber: 12,
    summary:
      'The village must be made to remember or be allowed to forget, and the party carries the cost of whichever they choose.',
  },
];

export const campaign: MourningfenCampaignFixture = {
  id: MOURNINGFEN_CAMPAIGN_ID,
  title: 'Lanterns of Mourningfen',
  subtitle: 'The marsh keeps every name the village forgets.',
  premise:
    'A dead ferryman’s lantern returns to the water, guiding travelers toward a homestead absent from every map. The party must uncover why the village traded away a family’s memory, and decide whether remembering them will release something worse. The Lantern Wardens keep the old bargain, the Reedbound want their names back, and something under the Verrow well has learned to count.',
  ruleset: 'D&D 5e',
  edition:
    '2014/2024 compatible; creatures identified per encounter, marsh spirits are custom',
  status: 'paused',
  pausedSince: '2026-08-28',
  pauseReason:
    'Table availability. Session 2 prep was stopped before the memory-loss choice was reviewed; the group agreed to resume once the missing-portraits handout is ready.',
  currentSessionId: mourningfenSessionId(2),
  actIds: campaignActs.map((act) => act.id),
  sessionIds: [1, 2, 3, 4].map(mourningfenSessionId),
  playerCharacters: [
    {
      id: `${MOURNINGFEN_CAMPAIGN_ID}-pc-anna`,
      name: 'Anna Pike',
      ancestry: 'Human',
      className: 'Ranger',
      level: 4,
      hook: 'Can navigate every marsh trail except one erased from her map.',
    },
    {
      id: `${MOURNINGFEN_CAMPAIGN_ID}-pc-corren`,
      name: 'Corren Moss',
      ancestry: 'Halfling',
      className: 'Druid',
      level: 4,
      hook: 'The reeds repeat a childhood nickname no living person knows.',
    },
    {
      id: `${MOURNINGFEN_CAMPAIGN_ID}-pc-ves`,
      name: 'Ves Nymm',
      ancestry: 'Elf',
      className: 'Cleric',
      level: 4,
      hook: 'Keeps funeral records containing a blank page that cannot be marked.',
    },
    {
      id: `${MOURNINGFEN_CAMPAIGN_ID}-pc-tallow`,
      name: 'Tallow',
      ancestry: 'Dragonborn',
      className: 'Sorcerer',
      level: 4,
      hook: 'Their magic burns blue near forgotten things.',
    },
  ],
  objectCounts: {
    all: 47,
    scenes: 6,
    encounters: 8,
    npcs: 11,
    lore: 9,
    handouts: 7,
  },
  nextSession: {
    sessionId: mourningfenSessionId(2),
    plannedDate: 'Sat, Oct 10, 2026',
    time: '4-8 PM',
    relativeDate: 'on hold (was 11 days out)',
    encounterId: 'encounter-shifting-rooms',
    npcId: 'npc-pim-verrow',
    locationId: 'location-verrow-homestead',
    questId: 'quest-what-the-house-remembers',
  },
  activity: {
    backlinks: [
      {
        id: 'backlink-pim-verrow',
        label: 'Pim Verrow',
        objectType: 'npc',
        targetId: 'npc-pim-verrow',
        detail: 'Youngest Verrow, counting rhyme',
      },
      {
        id: 'backlink-verrow-homestead',
        label: 'Verrow Homestead',
        objectType: 'location',
        targetId: 'location-verrow-homestead',
        detail: 'Session 2 location',
      },
      {
        id: 'backlink-shifting-rooms',
        label: 'The Shifting Rooms',
        objectType: 'encounter',
        targetId: 'encounter-shifting-rooms',
        detail: 'Session 2 encounter, prep incomplete',
      },
      {
        id: 'backlink-house-remembers',
        label: 'What the House Remembers',
        objectType: 'quest',
        targetId: 'quest-what-the-house-remembers',
        detail: 'High priority, active',
      },
    ],
    recentEdits: [
      {
        id: 'edit-shifting-rooms',
        label: 'The Shifting Rooms',
        objectType: 'encounter',
        targetId: 'encounter-shifting-rooms',
        detail: 'Encounter · last touched the day before the pause',
      },
      {
        id: 'edit-wardens',
        label: 'The Lantern Wardens',
        objectType: 'faction',
        targetId: 'faction-lantern-wardens',
        detail: 'Faction · 4 weeks ago, reeve tension left open',
      },
      {
        id: 'edit-reeve-crane',
        label: 'Reeve Hesper Crane',
        objectType: 'npc',
        targetId: 'npc-hesper-crane',
        detail: 'NPC · 4 weeks ago',
      },
      {
        id: 'edit-last-passenger',
        label: "The Ferryman's Last Fare",
        objectType: 'quest',
        targetId: 'quest-ferrymans-last-fare',
        detail: 'Quest · 5 weeks ago, marked on hold',
      },
      {
        id: 'edit-marsh-map',
        label: 'Map: Mourningfen Marsh',
        objectType: 'map',
        targetId: 'map-mourningfen-marsh',
        detail: 'Map · 6 weeks ago',
      },
    ],
  },
};
