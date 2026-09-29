import type {
  CampaignSession,
  SessionPlan,
  SessionPlanStep,
} from '../ashes-of-veyra/types';
import {
  MOURNINGFEN_ACT_1_ID,
  MOURNINGFEN_CAMPAIGN_ID,
  mourningfenSessionId,
} from './campaign';

type PlanStepInput = Omit<SessionPlanStep, 'id' | 'order'>;

interface PlanInput {
  revision: number;
  lastEdited: string;
  readiness: Array<{ label: string; complete: boolean }>;
  dependencies: SessionPlan['dependencies'];
  steps: PlanStepInput[];
  notes: string[];
  playerFacingSummary: string;
  attachments: string[];
}

/**
 * Step and readiness ids use the same `${campaign}-session-N-step-M` /
 * `-ready-M` convention as the campaign catalog, so the first two sessions
 * remain a strict superset of the catalog's showcase sessions.
 */
function buildPlan(sessionNumber: number, input: PlanInput): SessionPlan {
  const prefix = mourningfenSessionId(sessionNumber);
  const steps = input.steps.map((step, index) => ({
    ...step,
    id: `${prefix}-step-${index + 1}`,
    order: index + 1,
  }));
  return {
    revision: input.revision,
    lastEdited: input.lastEdited,
    estimatedMinutes: steps.reduce((sum, step) => sum + step.durationMinutes, 0),
    readiness: input.readiness.map((item, index) => ({
      ...item,
      id: `${prefix}-ready-${index + 1}`,
    })),
    dependencies: input.dependencies,
    steps,
    notes: input.notes,
    playerFacingSummary: input.playerFacingSummary,
    attachments: input.attachments,
  };
}

export const session1Plan: SessionPlan = buildPlan(1, {
  revision: 3,
  lastEdited: '6 weeks ago',
  readiness: [
    { label: 'Marsh route clues prepared', complete: true },
    { label: 'Ferryman dialogue cues prepared', complete: true },
  ],
  dependencies: [
    { objectId: 'scene-mourningfen-lantern-path', status: 'ready' },
    { objectId: 'encounter-lantern-loop', status: 'ready' },
    { objectId: 'encounter-reedbound-procession', status: 'ready' },
    { objectId: 'handout-births-register-extract', status: 'ready' },
  ],
  steps: [
    {
      kind: 'recap',
      track: 'main',
      title: 'Why no one crosses after dusk',
      durationMinutes: 10,
      visibility: 'shared',
      body: 'Ask each player what warning their character heard about the fen.',
    },
    {
      kind: 'scene',
      track: 'main',
      title: 'Follow the blue lantern',
      durationMinutes: 45,
      visibility: 'shared',
      objectId: 'scene-mourningfen-lantern-path',
      body: 'Three landmarks repeat unless the party gives up a memory at the drowned shrine.',
    },
    {
      kind: 'encounter',
      track: 'main',
      title: 'The reedbound procession',
      durationMinutes: 60,
      visibility: 'dm-only',
      objectId: 'encounter-reedbound-procession',
      body: 'The spirits can be fought, appeased with names, or followed to the forgotten homestead.',
    },
    {
      kind: 'closing',
      track: 'main',
      title: 'An empty place at every table',
      durationMinutes: 15,
      visibility: 'shared',
      objectId: 'handout-births-register-extract',
      body: 'The village records show five extra births and no deaths under the erased family name.',
    },
    {
      kind: 'handout',
      track: 'parallel',
      title: 'Tamsin’s folded tally',
      durationMinutes: 0,
      visibility: 'shared',
      objectId: 'handout-wardens-tithe-tally',
      body: 'Slip the tally to whichever character lingers at the lamp house. Do not explain it.',
    },
  ],
  notes: [
    'Record which memory each character offers; the fen can return it altered.',
    'Played as written. Ves recognised the blank funeral page; Bettin Sallow went quiet and has not been pressed.',
  ],
  playerFacingSummary:
    'A lantern belonging to a ferryman buried last winter is moving through the reeds again.',
  attachments: [
    'handout-ferrymans-lantern-tag',
    'handout-births-register-extract',
    'handout-blank-funeral-page',
    'handout-wardens-tithe-tally',
    'lore-reedbound-procession',
  ],
});

export const session2Plan: SessionPlan = buildPlan(2, {
  revision: 2,
  lastEdited: 'Yesterday',
  readiness: [
    { label: 'Room loop diagram complete', complete: true },
    { label: 'Missing family portraits ready', complete: false },
    { label: 'Final bargain consequences reviewed', complete: false },
  ],
  dependencies: [
    { objectId: 'scene-verrow-homestead-loop', status: 'ready' },
    { objectId: 'encounter-shifting-rooms', status: 'needs-review' },
    { objectId: 'handout-family-portrait-frames', status: 'needs-review' },
    { objectId: 'handout-counting-rhyme', status: 'ready' },
    { objectId: 'lore-forgetting-bargain', status: 'needs-review' },
  ],
  steps: [
    {
      kind: 'recap',
      track: 'main',
      title: 'Name what the fen took',
      durationMinutes: 15,
      visibility: 'shared',
      body: 'Invite players to restate surrendered memories and one sensory detail that remains.',
    },
    {
      kind: 'scene',
      track: 'main',
      title: 'Search the shifting homestead',
      durationMinutes: 65,
      visibility: 'shared',
      objectId: 'scene-verrow-homestead-loop',
      body: 'Rooms move when their mirrors are covered; family portraits restore the correct floor plan.',
    },
    {
      kind: 'handout',
      track: 'main',
      title: 'The youngest child’s counting rhyme',
      durationMinutes: 10,
      visibility: 'shared',
      objectId: 'handout-counting-rhyme',
      body: 'The rhyme names seven family members, but the final verse names an eighth voice beneath the well.',
    },
    {
      kind: 'choice',
      track: 'main',
      title: 'Restore the family or seal the well',
      durationMinutes: 35,
      visibility: 'shared',
      body: 'Restoration frees innocent ghosts but also gives the eighth voice a name; sealing the well preserves the village’s false history.',
    },
    {
      kind: 'closing',
      track: 'main',
      title: 'The village remembers',
      durationMinutes: 10,
      visibility: 'shared',
      body: 'Describe bells, arguments, or sudden grief based on the party’s choice.',
    },
    {
      kind: 'encounter',
      track: 'parallel',
      title: 'Shifting rooms (hazard pacing)',
      durationMinutes: 20,
      visibility: 'dm-only',
      objectId: 'encounter-shifting-rooms',
      body: 'Run only if the party rushes the search. Prep is incomplete: the poltergeist stat line is not yet adjusted for level 4.',
    },
    {
      kind: 'handout',
      track: 'parallel',
      title: 'Seven empty portrait frames',
      durationMinutes: 5,
      visibility: 'shared',
      objectId: 'handout-family-portrait-frames',
      body: 'Not yet drawn. Needed before the room loop can be solved on the intended path.',
    },
    {
      kind: 'note',
      track: 'parallel',
      title: 'Consequences of the well choice',
      durationMinutes: 0,
      visibility: 'dm-only',
      objectId: 'lore-forgetting-bargain',
      body: 'Unreviewed. Decide what the Wardens do if the well is sealed and what the Eighth Voice does if it is named.',
    },
  ],
  notes: [
    'The campaign is paused in the fixture so this session intentionally retains incomplete prep.',
    'Offer a safety break before the memory-loss choice.',
    'Paused with the memory-loss choice unreviewed. Do not resume without the portraits handout and the consequences note.',
  ],
  playerFacingSummary:
    'The house at the edge of the fen has no reflection, but it remembers each of you.',
  attachments: [
    'handout-counting-rhyme',
    'handout-family-portrait-frames',
    'lore-forgetting-bargain',
  ],
});

const sessionRecords: Array<
  Pick<
    CampaignSession,
    | 'number'
    | 'title'
    | 'status'
    | 'summary'
    | 'plannedDate'
    | 'durationHours'
    | 'partyLevel'
    | 'tags'
    | 'questIds'
    | 'npcIds'
    | 'factionIds'
    | 'locationIds'
    | 'encounterIds'
    | 'clueIds'
    | 'handoutIds'
    | 'plan'
  >
> = [
  {
    number: 1,
    title: 'The Lantern That Came Home',
    status: 'complete',
    summary:
      'The party follows a dead ferryman’s lantern into the marsh and learns that the village forgot an entire family.',
    plannedDate: '2026-08-14',
    durationHours: 4,
    partyLevel: 4,
    tags: ['Folk horror', 'Exploration', 'Social'],
    questIds: [
      'quest-follow-the-blue-lantern',
      'quest-village-that-forgot',
      'quest-ferrymans-last-fare',
    ],
    npcIds: [
      'npc-hesper-crane',
      'npc-odo-tarn',
      'npc-bettin-sallow',
      'npc-pim-verrow',
      'npc-ysolde-verrow',
      'npc-dunmore-fenn',
      'npc-tamsin-reed',
      'npc-goody-ashby',
    ],
    factionIds: [
      'faction-lantern-wardens',
      'faction-reedbound',
      'faction-burial-society',
      'faction-fenfolk-drovers',
    ],
    locationIds: [
      'location-mourningfen-village',
      'location-crossing-ferry-landing',
      'location-drowned-shrine',
      'location-verrow-homestead',
      'location-reedcutters-rest',
      'location-eel-market',
      'location-wardens-lamp-house',
    ],
    encounterIds: ['encounter-lantern-loop', 'encounter-reedbound-procession'],
    clueIds: [
      'clue-repeating-landmarks',
      'clue-extra-births',
      'clue-blank-funeral-page',
      'clue-lamp-oil-tithe',
      'clue-ferry-toll-coin',
    ],
    handoutIds: [
      'handout-ferrymans-lantern-tag',
      'handout-births-register-extract',
      'handout-blank-funeral-page',
      'handout-wardens-tithe-tally',
      'lore-reedbound-procession',
    ],
    plan: session1Plan,
  },
  {
    number: 2,
    title: 'A House With No Reflection',
    status: 'draft',
    summary:
      'Inside the forgotten homestead, rooms rearrange around the memories the party surrendered in the fen.',
    plannedDate: '2026-10-10',
    durationHours: 4,
    partyLevel: 4,
    tags: ['Haunted house', 'Puzzle', 'Rescue'],
    questIds: ['quest-what-the-house-remembers', 'quest-village-that-forgot'],
    npcIds: [
      'npc-pim-verrow',
      'npc-ysolde-verrow',
      'npc-hesper-crane',
      'npc-the-eighth-voice',
    ],
    factionIds: [
      'faction-reedbound',
      'faction-lantern-wardens',
      'faction-mere-below',
    ],
    locationIds: [
      'location-verrow-homestead',
      'location-homestead-nursery',
      'location-verrow-well',
    ],
    encounterIds: ['encounter-shifting-rooms', 'encounter-well-whisperer'],
    clueIds: ['clue-mirror-covers', 'clue-eighth-verse', 'clue-extra-births'],
    handoutIds: [
      'handout-counting-rhyme',
      'handout-family-portrait-frames',
      'lore-forgetting-bargain',
    ],
    plan: session2Plan,
  },
  {
    number: 3,
    title: 'The Lamp House Ledger',
    status: 'planned',
    summary:
      'Tamsin’s tally, Dunmore’s demand for proof and Bettin Sallow’s locked archive all point at the Wardens. The party chooses which thread to pull first.',
    partyLevel: 5,
    tags: ['Investigation', 'Social', 'Village politics'],
    questIds: [
      'quest-village-that-forgot',
      'quest-ferrymans-last-fare',
    ],
    npcIds: [
      'npc-hesper-crane',
      'npc-tamsin-reed',
      'npc-bettin-sallow',
      'npc-dunmore-fenn',
      'npc-odo-tarn',
    ],
    factionIds: [
      'faction-lantern-wardens',
      'faction-burial-society',
      'faction-fenfolk-drovers',
    ],
    locationIds: [
      'location-wardens-lamp-house',
      'location-mourningfen-village',
      'location-eel-market',
      'location-crossing-ferry-landing',
    ],
    encounterIds: ['encounter-warden-lamp-patrol', 'encounter-drover-standoff'],
    clueIds: [
      'clue-lamp-oil-tithe',
      'clue-blank-funeral-page',
      'clue-ferry-toll-coin',
    ],
    handoutIds: ['handout-wardens-tithe-tally', 'lore-fen-fever'],
  },
  {
    number: 4,
    title: 'What Answers From the Well',
    status: 'planned',
    summary:
      'Whatever the party decided about the well, the Eighth Voice replies. The Reedbound and the Wardens both want the party on their side.',
    partyLevel: 5,
    tags: ['Horror', 'Boss', 'Moral choice'],
    questIds: [
      'quest-the-eighth-voice',
      'quest-what-the-house-remembers',
    ],
    npcIds: [
      'npc-the-eighth-voice',
      'npc-pim-verrow',
      'npc-ysolde-verrow',
    ],
    factionIds: ['faction-mere-below', 'faction-reedbound'],
    locationIds: ['location-verrow-well', 'location-verrow-homestead'],
    encounterIds: ['encounter-well-whisperer'],
    clueIds: ['clue-eighth-verse'],
    handoutIds: ['lore-forgetting-bargain', 'handout-counting-rhyme'],
  },
];

export const sessions: CampaignSession[] = sessionRecords.map((record) => ({
  ...record,
  id: mourningfenSessionId(record.number),
  campaignId: MOURNINGFEN_CAMPAIGN_ID,
  actId: MOURNINGFEN_ACT_1_ID,
}));
