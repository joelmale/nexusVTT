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
    { objectId: 'encounter-sixth-chair-supper', status: 'ready' },
    { objectId: 'handout-ferry-ledger-pages', status: 'ready' },
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
    {
      kind: 'encounter',
      track: 'parallel',
      title: 'Supper at the sixth chair',
      durationMinutes: 15,
      visibility: 'dm-only',
      objectId: 'encounter-sixth-chair-supper',
      body: 'Run at the Reedcutters’ Rest if a character sits in the empty chair. Played: Anna counted six, then seven, then stopped counting.',
    },
    {
      kind: 'handout',
      track: 'parallel',
      title: 'The ferry ledger',
      durationMinutes: 5,
      visibility: 'shared',
      objectId: 'handout-ferry-ledger-pages',
      body: 'Maudlin Tarn lets the party read the ferry book at the landing. Crossing 41 is cut out.',
    },
  ],
  notes: [
    'Record which memory each character offers; the fen can return it altered.',
    'Played as written. Ves recognised the blank funeral page; Bettin Sallow went quiet and has not been pressed.',
    'Recap of play: the party paid one memory each at the drowned shrine (Anna: her mother’s lullaby; Corren: the name of his first boat; Ves: a funeral he officiated; Tallow: the colour of his hatchling shell). Ysolde Verrow spared them after Anna spoke her name.',
    'Open threads carried out of the session: the blank funeral page, Tamsin’s tally, Odo’s toll coin, and a seventh cup at the Burial Hall that nobody pours.',
  ],
  playerFacingSummary:
    'A lantern belonging to a ferryman buried last winter is moving through the reeds again.',
  attachments: [
    'handout-ferrymans-lantern-tag',
    'handout-births-register-extract',
    'handout-blank-funeral-page',
    'handout-wardens-tithe-tally',
    'lore-reedbound-procession',
    'handout-ferry-ledger-pages',
    'handout-long-table-seating-board',
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
    { objectId: 'encounter-grandam-kitchen', status: 'needs-review' },
    { objectId: 'handout-drowned-letter', status: 'ready' },
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
    {
      kind: 'encounter',
      track: 'parallel',
      title: 'Tea with the grandam',
      durationMinutes: 25,
      visibility: 'dm-only',
      objectId: 'encounter-grandam-kitchen',
      body: 'Ottoline Verrow in the kitchen. Roleplay first; the kettle only spits if she is addressed wrongly.',
    },
    {
      kind: 'handout',
      track: 'parallel',
      title: 'A letter sealed in a bottle',
      durationMinutes: 5,
      visibility: 'shared',
      objectId: 'handout-drowned-letter',
      body: 'Found beneath a loose nursery board when the boats are returned.',
    },
    {
      kind: 'encounter',
      track: 'parallel',
      title: 'The Pear-Wife’s bargain',
      durationMinutes: 15,
      visibility: 'dm-only',
      objectId: 'encounter-pear-wife',
      body: 'Optional orchard detour for a table that wants more mystery before the well.',
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
    'handout-drowned-letter',
    'handout-folk-remedy-card',
  ],
});

export const session3Plan: SessionPlan = buildPlan(3, {
  revision: 1,
  lastEdited: '3 weeks ago',
  readiness: [
    { label: 'Lamp House and archive maps drawn', complete: true },
    { label: 'Tithe night timeline written', complete: false },
    { label: 'Assize clerk voiced and statted', complete: false },
  ],
  dependencies: [
    { objectId: 'encounter-oil-cellar-sneak', status: 'needs-review' },
    { objectId: 'encounter-drover-standoff', status: 'ready' },
    { objectId: 'handout-assize-writ', status: 'ready' },
    { objectId: 'lore-lamp-lighting-rite', status: 'needs-review' },
  ],
  steps: [
    {
      kind: 'recap',
      track: 'main',
      title: 'What the house showed you',
      durationMinutes: 10,
      visibility: 'shared',
      body: 'Recap the choice at the well. Ask each player what they now believe the village owes the Verrows.',
    },
    {
      kind: 'scene',
      track: 'main',
      title: 'The village after the well',
      durationMinutes: 30,
      visibility: 'shared',
      objectId: 'location-mourningfen-village',
      body: 'Describe the boardwalk reacting to whatever the party decided. Place Halloran Wick on the corner, watching.',
    },
    {
      kind: 'choice',
      track: 'main',
      title: 'Which thread first',
      durationMinutes: 20,
      visibility: 'shared',
      body: 'Offer the lamp house tally, the archive door, and the eel-market proof as parallel leads. Let them choose; the others deadline themselves.',
    },
    {
      kind: 'encounter',
      track: 'main',
      title: 'Drover standoff',
      durationMinutes: 40,
      visibility: 'dm-only',
      objectId: 'encounter-drover-standoff',
      body: 'Dunmore decides whether his crews believe the party. Marl Quillon can be introduced here.',
    },
    {
      kind: 'handout',
      track: 'main',
      title: 'The Assize writ arrives',
      durationMinutes: 10,
      visibility: 'shared',
      objectId: 'handout-assize-writ',
      body: 'A bailiff delivers the writ to the Lamp House door. Whoever is nearest hears the reeve say, flatly, "Burn it."',
    },
    {
      kind: 'encounter',
      track: 'parallel',
      title: 'The oil cellar after dark',
      durationMinutes: 30,
      visibility: 'dm-only',
      objectId: 'encounter-oil-cellar-sneak',
      body: 'Run if Tamsin lets the party into the cellar. The handcart ruts lead toward the well.',
    },
    {
      kind: 'note',
      track: 'parallel',
      title: 'The tithe night timeline',
      durationMinutes: 0,
      visibility: 'dm-only',
      objectId: 'lore-lamp-lighting-rite',
      body: 'Unwritten. Decide what the Wardens do each hour from dusk to midnight and who is forgotten at the end.',
    },
    {
      kind: 'closing',
      track: 'main',
      title: 'A bell where there is no bell',
      durationMinutes: 10,
      visibility: 'shared',
      body: 'End on the ferry bell ringing seven times, once more than it should.',
    },
  ],
  notes: [
    'Do not run this until Session 2’s well choice is known; the village’s tone depends on it.',
    'Tamsin Reed is the pressure valve for the lamp house thread. If she is lost, Maudlin Tarn can carry the same information.',
    'The Assize clerk is a human antagonist, not a monster. Give her a clear, sympathetic goal.',
  ],
  playerFacingSummary:
    'The village has noticed you. A letter, a ledger and an old promise are all waiting to be read.',
  attachments: [
    'handout-wardens-tithe-tally',
    'handout-assize-writ',
    'handout-burial-roll-extract',
    'lore-fen-fever',
    'lore-lamp-lighting-rite',
  ],
});

export const session4Plan: SessionPlan = buildPlan(4, {
  revision: 1,
  lastEdited: '3 weeks ago',
  readiness: [
    { label: 'Eighth Voice voice and bargain written', complete: false },
    { label: 'Tithe-night encounters sequenced', complete: false },
  ],
  dependencies: [
    { objectId: 'encounter-well-whisperer', status: 'needs-review' },
    { objectId: 'lore-forgetting-bargain', status: 'needs-review' },
    { objectId: 'lore-lamp-lighting-rite', status: 'needs-review' },
  ],
  steps: [
    {
      kind: 'recap',
      track: 'main',
      title: 'Seven days of consequences',
      durationMinutes: 10,
      visibility: 'shared',
      body: 'Summarise what changed in the village since the well choice and what the party discovered at the lamp house.',
    },
    {
      kind: 'scene',
      track: 'main',
      title: 'The tithe procession',
      durationMinutes: 40,
      visibility: 'shared',
      body: 'The Wardens carry oil to the well in the fog. Reedbound lanterns line the opposite bank.',
    },
    {
      kind: 'encounter',
      track: 'main',
      title: 'What answers from the well',
      durationMinutes: 60,
      visibility: 'dm-only',
      objectId: 'encounter-well-whisperer',
      body: 'The Eighth Voice bargains, then attacks if refused. A named or sealed well reshapes the fight.',
    },
    {
      kind: 'closing',
      track: 'main',
      title: 'The count is eight',
      durationMinutes: 10,
      visibility: 'shared',
      body: 'End on the rhyme completing, or being cut off, and what the village hears.',
    },
    {
      kind: 'encounter',
      track: 'parallel',
      title: 'The Assize retinue at the gate',
      durationMinutes: 20,
      visibility: 'dm-only',
      objectId: 'encounter-assize-bailiffs',
      body: 'If the party has engaged Sabine Vale, she arrives with the bailiffs just before the tithe.',
    },
  ],
  notes: [
    'The finale of Act I. Prep only after Sessions 2 and 3 are played.',
    'Offer a safety check before the memory-loss choices.',
  ],
  playerFacingSummary:
    'The village counts to seven. Something beneath you has learned to count to eight.',
  attachments: [
    'handout-counting-rhyme',
    'lore-forgetting-bargain',
    'lore-lamp-lighting-rite',
    'handout-assize-writ',
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
      'quest-a-place-at-the-long-table',
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
      'npc-maudlin-tarn',
      'npc-halloran-wick',
      'npc-jun-fenn',
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
      'location-reedwalk',
      'location-tidewake-burial-hall',
    ],
    encounterIds: [
      'encounter-lantern-loop',
      'encounter-reedbound-procession',
      'encounter-sixth-chair-supper',
      'encounter-reedwalk-sinkholes',
    ],
    clueIds: [
      'clue-repeating-landmarks',
      'clue-extra-births',
      'clue-blank-funeral-page',
      'clue-lamp-oil-tithe',
      'clue-ferry-toll-coin',
      'clue-sixth-chair',
      'clue-odo-lantern-blue',
      'clue-ferry-ledger-gap',
    ],
    handoutIds: [
      'handout-ferrymans-lantern-tag',
      'handout-births-register-extract',
      'handout-blank-funeral-page',
      'handout-wardens-tithe-tally',
      'lore-reedbound-procession',
      'handout-ferry-ledger-pages',
      'handout-long-table-seating-board',
      'handout-drover-work-song',
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
    questIds: [
      'quest-what-the-house-remembers',
      'quest-village-that-forgot',
      'quest-pims-seven-boats',
    ],
    npcIds: [
      'npc-pim-verrow',
      'npc-ysolde-verrow',
      'npc-hesper-crane',
      'npc-the-eighth-voice',
      'npc-ottoline-verrow',
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
      'location-verrow-hall',
      'location-verrow-kitchen',
      'location-salt-pear-orchard',
    ],
    encounterIds: [
      'encounter-shifting-rooms',
      'encounter-well-whisperer',
      'encounter-grandam-kitchen',
      'encounter-pear-wife',
    ],
    clueIds: [
      'clue-mirror-covers',
      'clue-eighth-verse',
      'clue-extra-births',
      'clue-remedy-card',
      'clue-assize-seal',
      'clue-salt-pear-orchard',
    ],
    handoutIds: [
      'handout-counting-rhyme',
      'handout-family-portrait-frames',
      'lore-forgetting-bargain',
      'handout-drowned-letter',
      'handout-folk-remedy-card',
      'handout-drover-work-song',
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
      'quest-the-tithe-night',
      'quest-the-remedy-for-forgetting',
      'quest-the-assize-rides-in',
    ],
    npcIds: [
      'npc-hesper-crane',
      'npc-tamsin-reed',
      'npc-bettin-sallow',
      'npc-dunmore-fenn',
      'npc-odo-tarn',
      'npc-marl-quillon',
      'npc-fenwick-oar',
      'npc-sabine-vale',
      'npc-halloran-wick',
      'npc-maudlin-tarn',
      'npc-jun-fenn',
    ],
    factionIds: [
      'faction-lantern-wardens',
      'faction-burial-society',
      'faction-fenfolk-drovers',
      'faction-marrowbone-circle',
      'faction-greywater-assize',
    ],
    locationIds: [
      'location-wardens-lamp-house',
      'location-mourningfen-village',
      'location-eel-market',
      'location-crossing-ferry-landing',
      'location-lantern-oil-cellar',
      'location-tidewake-burial-hall',
      'location-tidewake-archive',
      'location-tidewake-burying-ground',
      'location-reedwalk',
    ],
    encounterIds: [
      'encounter-warden-lamp-patrol',
      'encounter-drover-standoff',
      'encounter-oil-cellar-sneak',
      'encounter-unnamed-dead',
      'encounter-assize-bailiffs',
      'encounter-reedwalk-sinkholes',
    ],
    clueIds: [
      'clue-lamp-oil-tithe',
      'clue-blank-funeral-page',
      'clue-ferry-toll-coin',
      'clue-oil-cart-ruts',
      'clue-remedy-card',
      'clue-assize-seal',
      'clue-ferry-ledger-gap',
    ],
    handoutIds: [
      'handout-wardens-tithe-tally',
      'lore-fen-fever',
      'handout-burial-roll-extract',
      'handout-assize-writ',
      'handout-folk-remedy-card',
      'lore-lamp-lighting-rite',
      'lore-marrowbone-circle',
      'handout-ferry-ledger-pages',
    ],
    plan: session3Plan,
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
      'quest-the-tithe-night',
      'quest-the-assize-rides-in',
    ],
    npcIds: [
      'npc-the-eighth-voice',
      'npc-pim-verrow',
      'npc-ysolde-verrow',
      'npc-sabine-vale',
    ],
    factionIds: [
      'faction-mere-below',
      'faction-reedbound',
      'faction-greywater-assize',
      'faction-lantern-wardens',
    ],
    locationIds: [
      'location-verrow-well',
      'location-verrow-homestead',
      'location-lantern-oil-cellar',
    ],
    encounterIds: ['encounter-well-whisperer', 'encounter-assize-bailiffs'],
    clueIds: ['clue-eighth-verse', 'clue-oil-cart-ruts'],
    handoutIds: [
      'lore-forgetting-bargain',
      'handout-counting-rhyme',
      'handout-assize-writ',
      'lore-lamp-lighting-rite',
    ],
    plan: session4Plan,
  },
];

export const sessions: CampaignSession[] = sessionRecords.map((record) => ({
  ...record,
  id: mourningfenSessionId(record.number),
  campaignId: MOURNINGFEN_CAMPAIGN_ID,
  actId: MOURNINGFEN_ACT_1_ID,
}));
