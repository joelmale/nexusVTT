import type {
  CampaignSession,
  SessionPlan,
  SessionPlanStep,
} from '../ashes-of-veyra/types';
import {
  KHARAD_ACT_ONE_ID,
  KHARAD_CAMPAIGN_ID,
  KHARAD_SESSION_1_ID,
  KHARAD_SESSION_2_ID,
  KHARAD_SESSION_3_ID,
} from './campaign';

type StepInput = Omit<SessionPlanStep, 'id' | 'order'>;

function buildPlan(input: {
  idPrefix: string;
  revision: number;
  lastEdited: string;
  readiness: string[];
  dependencies: string[];
  steps: StepInput[];
  notes: string[];
  playerFacingSummary: string;
  attachments: string[];
}): SessionPlan {
  const steps = input.steps.map((step, index) => ({
    ...step,
    id: `${input.idPrefix}-step-${index + 1}`,
    order: index + 1,
  }));
  return {
    revision: input.revision,
    lastEdited: input.lastEdited,
    estimatedMinutes: steps.reduce(
      (total, step) => total + step.durationMinutes,
      0,
    ),
    readiness: input.readiness.map((label, index) => ({
      id: `${input.idPrefix}-ready-${index + 1}`,
      label,
      complete: true,
    })),
    dependencies: input.dependencies.map((objectId) => ({
      objectId,
      status: 'ready' as const,
    })),
    steps,
    notes: input.notes,
    playerFacingSummary: input.playerFacingSummary,
    attachments: input.attachments,
  };
}

export const session1Plan: SessionPlan = buildPlan({
  idPrefix: KHARAD_SESSION_1_ID,
  revision: 4,
  lastEdited: '5 months ago',
  readiness: [
    'Collapsed mine skill challenge ready',
    'Star engine diagram ready',
    'Rescued miner names written',
  ],
  dependencies: [
    'encounter-resonant-fault-collapse',
    'encounter-survey-crew-defense',
    'handout-inverted-star-chart',
  ],
  steps: [
    {
      kind: 'scene',
      track: 'main',
      title: 'Descend through the singing fault',
      durationMinutes: 40,
      visibility: 'shared',
      objectId: 'encounter-resonant-fault-collapse',
      body: 'Rescue trapped miners while crystalline echoes imitate the party’s plans one minute early.',
    },
    {
      kind: 'encounter',
      track: 'main',
      title: 'Defend the survey crew',
      durationMinutes: 55,
      visibility: 'dm-only',
      objectId: 'encounter-survey-crew-defense',
      body: 'Gravitic pulses move every creature toward a different wall at initiative count 20.',
    },
    {
      kind: 'handout',
      track: 'main',
      title: 'Read the inverted star chart',
      durationMinutes: 25,
      visibility: 'shared',
      objectId: 'handout-inverted-star-chart',
      body: 'The chart identifies Kharad as one point in a buried constellation spanning seven holds.',
    },
    {
      kind: 'closing',
      track: 'main',
      title: 'The first star wakes',
      durationMinutes: 10,
      visibility: 'shared',
      body: 'A violet light ignites miles below, and every compass turns downward.',
    },
    {
      kind: 'note',
      track: 'parallel',
      title: 'Outcome: every miner lived',
      durationMinutes: 0,
      visibility: 'dm-only',
      body: 'All eleven trapped miners were brought out; Foreman Brack owes the party the Delvers’ Union’s trust for the rest of the campaign.',
    },
    {
      kind: 'handout',
      track: 'parallel',
      title: 'Survey Crew Log',
      durationMinutes: 3,
      visibility: 'shared',
      objectId: 'handout-survey-crew-log',
      body: 'Surface when the party searches the observatory’s antechamber for the missing surveyors.',
    },
  ],
  notes: [
    'Give rescued miners names before revealing the observatory.',
    'Recap: the party pulled the survey crew out of the Kharad collapse, found the inverted observatory, and watched the first star wake.',
  ],
  playerFacingSummary:
    'The mine collapse was no accident, and the light below Kharad does not come from fire. You brought everyone out alive, and now every compass points down.',
  attachments: ['handout-inverted-star-chart', 'handout-survey-crew-log'],
});

export const session2Plan: SessionPlan = buildPlan({
  idPrefix: KHARAD_SESSION_2_ID,
  revision: 5,
  lastEdited: '4 months ago',
  readiness: [
    'Hold delegate motives ready',
    'Transit gate complications ready',
    'Ordrun ambush map ready',
  ],
  dependencies: [
    'encounter-council-at-broken-gate',
    'encounter-transit-line-chase',
    'encounter-ordrun-station-ambush',
    'handout-concord-writ-of-custodianship',
  ],
  steps: [
    {
      kind: 'recap',
      track: 'main',
      title: 'The buried constellation',
      durationMinutes: 10,
      visibility: 'shared',
      body: 'Place seven hold tokens on the chart and mark the newly awakened point.',
    },
    {
      kind: 'scene',
      track: 'main',
      title: 'Council at the broken gate',
      durationMinutes: 50,
      visibility: 'shared',
      objectId: 'encounter-council-at-broken-gate',
      body: 'Each delegate offers aid with a visible price; two privately ask the party to sabotage a rival.',
    },
    {
      kind: 'encounter',
      track: 'main',
      title: 'Run the unstable transit line',
      durationMinutes: 70,
      visibility: 'dm-only',
      objectId: 'encounter-transit-line-chase',
      body: 'A three-stage chase crosses abandoned stations as the rival expedition closes from behind.',
    },
    {
      kind: 'choice',
      track: 'main',
      title: 'Name the engine’s custodian',
      durationMinutes: 25,
      visibility: 'shared',
      objectId: 'handout-concord-writ-of-custodianship',
      body: 'The gate activates only after someone accepts legal and magical responsibility for it.',
    },
    {
      kind: 'encounter',
      track: 'main',
      title: 'Ordrun’s ambush at Meridian Station',
      durationMinutes: 40,
      visibility: 'dm-only',
      objectId: 'encounter-ordrun-station-ambush',
      body: 'The rival marshal springs her trap the moment the gate opens; she breaks off once the party holds her sealed orders.',
    },
    {
      kind: 'handout',
      track: 'parallel',
      title: 'Ordrun’s Sealed Orders',
      durationMinutes: 3,
      visibility: 'dm-only',
      objectId: 'handout-ordrun-sealed-orders',
      body: 'Recovered from the marshal’s courier; reveals the Ardent Deep Company intends to weaponize the vessel.',
    },
    {
      kind: 'note',
      track: 'parallel',
      title: 'Outcome: Dagna signs as custodian',
      durationMinutes: 0,
      visibility: 'dm-only',
      body: 'Dagna Seven-Chalks accepted custodianship. The party declined both secret sabotage requests, souring Hold Duskforge.',
    },
    {
      kind: 'closing',
      track: 'main',
      title: 'The gate opens on the deep sky',
      durationMinutes: 10,
      visibility: 'shared',
      body: 'The gate spits the party onto a platform with no ceiling, only the seven-hold constellation turning overhead.',
    },
  ],
  notes: [
    'Track promises to each hold; every accepted resource creates a finale complication.',
    'Recap: the Concord met at the broken gate, the party ran the transit line, beat Ordrun’s ambush, and named Dagna custodian.',
  ],
  playerFacingSummary:
    'Seven holds claim the star beneath Kharad, and the road between them has just reopened. You crossed it first, and your name is on the writ.',
  attachments: [
    'lore-seven-holds-charter',
    'handout-concord-writ-of-custodianship',
    'handout-ordrun-sealed-orders',
  ],
});

export const session3Plan: SessionPlan = buildPlan({
  idPrefix: KHARAD_SESSION_3_ID,
  revision: 6,
  lastEdited: '4 months ago',
  readiness: [
    'Final chamber phases ready',
    'Faction consequence cards ready',
    'Epilogue prompts ready',
    'Legacy lore archived',
  ],
  dependencies: [
    'encounter-zero-gravity-vault',
    'encounter-astronomer-awakens',
    'encounter-fate-of-the-vessel',
    'handout-astronomers-final-message',
    'handout-epilogue-proclamation',
  ],
  steps: [
    {
      kind: 'scene',
      track: 'main',
      title: 'Cross the zero-gravity vault',
      durationMinutes: 45,
      visibility: 'shared',
      objectId: 'encounter-zero-gravity-vault',
      body: 'Characters navigate by jumping between fragments of the seven holds’ shared history.',
    },
    {
      kind: 'encounter',
      track: 'main',
      title: 'The astronomer awakens',
      durationMinutes: 90,
      visibility: 'dm-only',
      objectId: 'encounter-astronomer-awakens',
      body: 'The guardian changes gravity, terrain, and its goal as three engine rings align.',
    },
    {
      kind: 'choice',
      track: 'main',
      title: 'Choose the fate of the vessel',
      durationMinutes: 35,
      visibility: 'shared',
      objectId: 'encounter-fate-of-the-vessel',
      body: 'Launch, burial, and ignition each honor one promise and break at least one other.',
    },
    {
      kind: 'handout',
      track: 'main',
      title: 'The Astronomer’s final message',
      durationMinutes: 5,
      visibility: 'shared',
      objectId: 'handout-astronomers-final-message',
      body: 'Read aloud once the guardian surrenders and the rings fall still.',
    },
    {
      kind: 'closing',
      track: 'main',
      title: 'Epilogues under a changed sky',
      durationMinutes: 30,
      visibility: 'shared',
      objectId: 'handout-epilogue-proclamation',
      body: 'Ask each player what their character builds now that the holds must share a future.',
    },
    {
      kind: 'note',
      track: 'parallel',
      title: 'Outcome: the deep sun',
      durationMinutes: 0,
      visibility: 'dm-only',
      body: 'The party kindled the vessel rather than launching or burying it. Five promises held; the promise to Hold Duskforge for a weapon was broken.',
    },
    {
      kind: 'note',
      track: 'parallel',
      title: 'Campaign wrap-up and legacy',
      durationMinutes: 0,
      visibility: 'dm-only',
      objectId: 'lore-legacy-of-kharad',
      body: 'Archive the campaign; the legacy lore entry records how the holds remember the party.',
    },
  ],
  notes: [
    'Resolve faction promises before describing the cosmic result.',
    'The guardian can surrender once the party articulates a shared purpose.',
    'Recap: the party crossed the vault, out-argued the Astronomer as three rings aligned, and kindled the vessel into a deep sun.',
  ],
  playerFacingSummary:
    'The deep sky is opening. What waits beneath Kharad was built to carry a civilization—or burn one. You chose a third road: a sun of your own making.',
  attachments: [
    'lore-star-engine-purpose',
    'handout-astronomers-final-message',
    'handout-epilogue-proclamation',
    'lore-legacy-of-kharad',
  ],
});

export const sessions: CampaignSession[] = [
  {
    id: KHARAD_SESSION_1_ID,
    campaignId: KHARAD_CAMPAIGN_ID,
    actId: KHARAD_ACT_ONE_ID,
    number: 1,
    title: 'The Observatory Beneath the Mine',
    status: 'complete',
    summary:
      'A routine rescue exposes an ancient observatory whose constellations depict caverns instead of the sky.',
    plannedDate: '2026-05-02',
    durationHours: 4,
    partyLevel: 9,
    tags: ['Underdark', 'Rescue', 'Discovery'],
    questIds: ['quest-rescue-survey-crew', 'quest-read-inverted-chart'],
    npcIds: ['npc-tamsin-brack', 'npc-yarrow-stonesinger', 'npc-pell-quartz'],
    factionIds: ['faction-kharad-delvers-union', 'faction-chalkline-collegium'],
    locationIds: [
      'location-kharad-mine',
      'location-singing-fault',
      'location-inverted-observatory',
    ],
    encounterIds: [
      'encounter-resonant-fault-collapse',
      'encounter-survey-crew-defense',
    ],
    clueIds: ['clue-echoes-run-early', 'clue-inverted-constellation'],
    handoutIds: ['handout-inverted-star-chart', 'handout-survey-crew-log'],
    plan: session1Plan,
  },
  {
    id: KHARAD_SESSION_2_ID,
    campaignId: KHARAD_CAMPAIGN_ID,
    actId: KHARAD_ACT_ONE_ID,
    number: 2,
    title: 'Seven Holds, One Night',
    status: 'complete',
    summary:
      'The party races a rival expedition through a transit gate while negotiating which hold will control the star engine.',
    plannedDate: '2026-05-16',
    durationHours: 4,
    partyLevel: 9,
    tags: ['Political', 'Race', 'Planar transit'],
    questIds: [
      'quest-open-the-transit-gate',
      'quest-sabotage-for-the-holds',
      'quest-race-ordrun-to-the-engine',
    ],
    npcIds: [
      'npc-hrolda-ironvein',
      'npc-vessa-ordrun',
      'npc-oskar-deepfire',
      'npc-ilsa-vaunt',
      'npc-pell-quartz',
    ],
    factionIds: [
      'faction-seven-hold-concord',
      'faction-ardent-deep-company',
      'faction-duskforge-hold',
    ],
    locationIds: [
      'location-broken-gate-hall',
      'location-transit-line',
      'location-kharad-commons',
    ],
    encounterIds: [
      'encounter-council-at-broken-gate',
      'encounter-transit-line-chase',
      'encounter-ordrun-station-ambush',
    ],
    clueIds: [
      'clue-seven-hold-seals',
      'clue-gate-custodian-oath',
      'clue-ordrun-orders',
    ],
    handoutIds: [
      'lore-seven-holds-charter',
      'handout-concord-writ-of-custodianship',
      'handout-ordrun-sealed-orders',
    ],
    plan: session2Plan,
  },
  {
    id: KHARAD_SESSION_3_ID,
    campaignId: KHARAD_CAMPAIGN_ID,
    actId: KHARAD_ACT_ONE_ID,
    number: 3,
    title: 'When the Deep Sky Opens',
    status: 'complete',
    summary:
      'At the heart of the constellation, the party decides whether to launch an impossible vessel, bury it, or turn it into a new sun.',
    plannedDate: '2026-05-30',
    durationHours: 5,
    partyLevel: 10,
    tags: ['Finale', 'Mythic combat', 'Consequences'],
    questIds: [
      'quest-race-ordrun-to-the-engine',
      'quest-fate-of-the-vessel',
      'quest-honor-the-seven-promises',
    ],
    npcIds: [
      'npc-the-astronomer',
      'npc-hrolda-ironvein',
      'npc-oskar-deepfire',
      'npc-vessa-ordrun',
      'npc-ilsa-vaunt',
      'npc-yarrow-stonesinger',
      'npc-pell-quartz',
      'npc-tamsin-brack',
    ],
    factionIds: [
      'faction-astronomers-watch',
      'faction-seven-hold-concord',
      'faction-duskforge-hold',
      'faction-ardent-deep-company',
      'faction-kharad-delvers-union',
      'faction-chalkline-collegium',
    ],
    locationIds: [
      'location-zero-gravity-vault',
      'location-engine-heart',
      'location-kharad-commons',
    ],
    encounterIds: [
      'encounter-zero-gravity-vault',
      'encounter-astronomer-awakens',
      'encounter-fate-of-the-vessel',
    ],
    clueIds: [
      'clue-engine-ring-alignment',
      'clue-astronomers-purpose',
      'clue-ark-or-weapon',
    ],
    handoutIds: [
      'lore-star-engine-purpose',
      'handout-astronomers-final-message',
      'handout-epilogue-proclamation',
      'lore-legacy-of-kharad',
    ],
    plan: session3Plan,
  },
];
