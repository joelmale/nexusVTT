import { campaign as ashesCampaign } from '../ashes-of-veyra/campaign';
import { sessions as ashesSessions } from '../ashes-of-veyra/sessions';
import type {
  CampaignSession,
  PlayerCharacter,
  SessionPlan,
  SessionPlanStep,
} from '../ashes-of-veyra/types';
import type { CampaignCatalogEntry, CatalogIntegrityIssue } from './types';

const CROWN_ID = 'campaign-crown-of-cinders';
const MOURNINGFEN_ID = 'campaign-lanterns-of-mourningfen';
const KHARAD_ID = 'campaign-stars-below-kharad';

interface PlanInput {
  idPrefix: string;
  lastEdited: string;
  readiness: Array<{ label: string; complete: boolean }>;
  steps: Omit<SessionPlanStep, 'id' | 'order'>[];
  notes: string[];
  playerFacingSummary: string;
}

function createPlan(input: PlanInput): SessionPlan {
  const steps = input.steps.map((step, index) => ({
    ...step,
    id: `${input.idPrefix}-step-${index + 1}`,
    order: index + 1,
  }));

  return {
    revision: 1,
    lastEdited: input.lastEdited,
    estimatedMinutes: steps.reduce(
      (total, step) => total + step.durationMinutes,
      0,
    ),
    readiness: input.readiness.map((item, index) => ({
      ...item,
      id: `${input.idPrefix}-ready-${index + 1}`,
    })),
    dependencies: [],
    steps,
    notes: input.notes,
    playerFacingSummary: input.playerFacingSummary,
    attachments: [],
  };
}

interface SessionInput {
  campaignId: string;
  actId: string;
  number: number;
  title: string;
  status: CampaignSession['status'];
  summary: string;
  plannedDate?: string;
  durationHours?: number;
  partyLevel: number;
  tags: string[];
  plan: SessionPlan;
}

function createSession(input: SessionInput): CampaignSession {
  return {
    id: `${input.campaignId}-session-${input.number}`,
    campaignId: input.campaignId,
    actId: input.actId,
    number: input.number,
    title: input.title,
    status: input.status,
    summary: input.summary,
    plannedDate: input.plannedDate,
    durationHours: input.durationHours,
    partyLevel: input.partyLevel,
    tags: input.tags,
    questIds: [],
    npcIds: [],
    factionIds: [],
    locationIds: [],
    encounterIds: [],
    clueIds: [],
    handoutIds: [],
    plan: input.plan,
  };
}

const crownSession = createSession({
  campaignId: CROWN_ID,
  actId: `${CROWN_ID}-act-1`,
  number: 1,
  title: 'Embers at the Coronation',
  status: 'planned',
  summary:
    'A royal investiture erupts into an elemental assassination, leaving the party with a talking crown and three competing heirs.',
  plannedDate: '2026-10-03',
  durationHours: 3,
  partyLevel: 1,
  tags: ['Court intrigue', 'Mystery', 'Elemental hazard'],
  plan: createPlan({
    idPrefix: `${CROWN_ID}-session-1`,
    lastEdited: '20 minutes ago',
    readiness: [
      { label: 'Heir relationship cards written', complete: true },
      { label: 'Ballroom hazard map reviewed', complete: true },
      { label: 'Crown voice handout recorded', complete: false },
    ],
    steps: [
      {
        kind: 'scene',
        track: 'main',
        title: 'The Hall of Nine Banners',
        durationMinutes: 25,
        visibility: 'shared',
        body: 'Let each character meet an heir and hear one contradictory rumor before the ceremony begins.',
      },
      {
        kind: 'encounter',
        track: 'main',
        title: 'Cinder wights breach the dais',
        durationMinutes: 55,
        visibility: 'dm-only',
        body: 'Wights ignite curtains to split the room; rescuing guests matters more than defeating every attacker.',
      },
      {
        kind: 'choice',
        track: 'main',
        title: 'Choose which heir receives the crown',
        durationMinutes: 30,
        visibility: 'shared',
        body: 'The crown whispers that all three heirs are lying, but only one lie concerns the assassination.',
      },
      {
        kind: 'closing',
        track: 'main',
        title: 'A fourth claimant arrives',
        durationMinutes: 10,
        visibility: 'shared',
        body: 'End as an ash-streaked courier presents a sealed genealogy naming a dead prince.',
      },
    ],
    notes: [
      'Keep the three heirs sympathetic; this is a values choice, not a correct-answer puzzle.',
      'Use the burning tapestries as a visible three-round clock.',
    ],
    playerFacingSummary:
      'You came to witness a coronation. By nightfall, the realm may ask you to choose its ruler.',
  }),
});

const mourningfenSessions: CampaignSession[] = [
  createSession({
    campaignId: MOURNINGFEN_ID,
    actId: `${MOURNINGFEN_ID}-act-1`,
    number: 1,
    title: 'The Lantern That Came Home',
    status: 'complete',
    summary:
      'The party follows a dead ferryman’s lantern into the marsh and learns that the village forgot an entire family.',
    plannedDate: '2026-08-14',
    durationHours: 4,
    partyLevel: 4,
    tags: ['Folk horror', 'Exploration', 'Social'],
    plan: createPlan({
      idPrefix: `${MOURNINGFEN_ID}-session-1`,
      lastEdited: '6 weeks ago',
      readiness: [
        { label: 'Marsh route clues prepared', complete: true },
        { label: 'Ferryman dialogue cues prepared', complete: true },
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
          body: 'Three landmarks repeat unless the party gives up a memory at the drowned shrine.',
        },
        {
          kind: 'encounter',
          track: 'main',
          title: 'The reedbound procession',
          durationMinutes: 60,
          visibility: 'dm-only',
          body: 'The spirits can be fought, appeased with names, or followed to the forgotten homestead.',
        },
        {
          kind: 'closing',
          track: 'main',
          title: 'An empty place at every table',
          durationMinutes: 15,
          visibility: 'shared',
          body: 'The village records show five extra births and no deaths under the erased family name.',
        },
      ],
      notes: [
        'Record which memory each character offers; the fen can return it altered.',
      ],
      playerFacingSummary:
        'A lantern belonging to a ferryman buried last winter is moving through the reeds again.',
    }),
  }),
  createSession({
    campaignId: MOURNINGFEN_ID,
    actId: `${MOURNINGFEN_ID}-act-1`,
    number: 2,
    title: 'A House With No Reflection',
    status: 'draft',
    summary:
      'Inside the forgotten homestead, rooms rearrange around the memories the party surrendered in the fen.',
    plannedDate: '2026-10-10',
    durationHours: 4,
    partyLevel: 4,
    tags: ['Haunted house', 'Puzzle', 'Rescue'],
    plan: createPlan({
      idPrefix: `${MOURNINGFEN_ID}-session-2`,
      lastEdited: 'Yesterday',
      readiness: [
        { label: 'Room loop diagram complete', complete: true },
        { label: 'Missing family portraits ready', complete: false },
        { label: 'Final bargain consequences reviewed', complete: false },
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
          body: 'Rooms move when their mirrors are covered; family portraits restore the correct floor plan.',
        },
        {
          kind: 'handout',
          track: 'main',
          title: 'The youngest child’s counting rhyme',
          durationMinutes: 10,
          visibility: 'shared',
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
      ],
      notes: [
        'The campaign is paused in the fixture so this session intentionally retains incomplete prep.',
        'Offer a safety break before the memory-loss choice.',
      ],
      playerFacingSummary:
        'The house at the edge of the fen has no reflection, but it remembers each of you.',
    }),
  }),
];

const kharadSessions: CampaignSession[] = [
  createSession({
    campaignId: KHARAD_ID,
    actId: `${KHARAD_ID}-act-1`,
    number: 1,
    title: 'The Observatory Beneath the Mine',
    status: 'complete',
    summary:
      'A routine rescue exposes an ancient observatory whose constellations depict caverns instead of the sky.',
    plannedDate: '2026-05-02',
    durationHours: 4,
    partyLevel: 9,
    tags: ['Underdark', 'Rescue', 'Discovery'],
    plan: createPlan({
      idPrefix: `${KHARAD_ID}-session-1`,
      lastEdited: '5 months ago',
      readiness: [
        { label: 'Collapsed mine skill challenge ready', complete: true },
        { label: 'Star engine diagram ready', complete: true },
      ],
      steps: [
        {
          kind: 'scene',
          track: 'main',
          title: 'Descend through the singing fault',
          durationMinutes: 40,
          visibility: 'shared',
          body: 'Rescue trapped miners while crystalline echoes imitate the party’s plans one minute early.',
        },
        {
          kind: 'encounter',
          track: 'main',
          title: 'Defend the survey crew',
          durationMinutes: 55,
          visibility: 'dm-only',
          body: 'Gravitic pulses move every creature toward a different wall at initiative count 20.',
        },
        {
          kind: 'handout',
          track: 'main',
          title: 'Read the inverted star chart',
          durationMinutes: 25,
          visibility: 'shared',
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
      ],
      notes: ['Give rescued miners names before revealing the observatory.'],
      playerFacingSummary:
        'The mine collapse was no accident, and the light below Kharad does not come from fire.',
    }),
  }),
  createSession({
    campaignId: KHARAD_ID,
    actId: `${KHARAD_ID}-act-1`,
    number: 2,
    title: 'Seven Holds, One Night',
    status: 'complete',
    summary:
      'The party races a rival expedition through a transit gate while negotiating which hold will control the star engine.',
    plannedDate: '2026-05-16',
    durationHours: 4,
    partyLevel: 9,
    tags: ['Political', 'Race', 'Planar transit'],
    plan: createPlan({
      idPrefix: `${KHARAD_ID}-session-2`,
      lastEdited: '4 months ago',
      readiness: [
        { label: 'Hold delegate motives ready', complete: true },
        { label: 'Transit gate complications ready', complete: true },
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
          body: 'Each delegate offers aid with a visible price; two privately ask the party to sabotage a rival.',
        },
        {
          kind: 'encounter',
          track: 'main',
          title: 'Run the unstable transit line',
          durationMinutes: 70,
          visibility: 'dm-only',
          body: 'A three-stage chase crosses abandoned stations as the rival expedition closes from behind.',
        },
        {
          kind: 'choice',
          track: 'main',
          title: 'Name the engine’s custodian',
          durationMinutes: 25,
          visibility: 'shared',
          body: 'The gate activates only after someone accepts legal and magical responsibility for it.',
        },
      ],
      notes: [
        'Track promises to each hold; every accepted resource creates a finale complication.',
      ],
      playerFacingSummary:
        'Seven holds claim the star beneath Kharad, and the road between them has just reopened.',
    }),
  }),
  createSession({
    campaignId: KHARAD_ID,
    actId: `${KHARAD_ID}-act-1`,
    number: 3,
    title: 'When the Deep Sky Opens',
    status: 'complete',
    summary:
      'At the heart of the constellation, the party decides whether to launch an impossible vessel, bury it, or turn it into a new sun.',
    plannedDate: '2026-05-30',
    durationHours: 5,
    partyLevel: 10,
    tags: ['Finale', 'Mythic combat', 'Consequences'],
    plan: createPlan({
      idPrefix: `${KHARAD_ID}-session-3`,
      lastEdited: '4 months ago',
      readiness: [
        { label: 'Final chamber phases ready', complete: true },
        { label: 'Faction consequence cards ready', complete: true },
        { label: 'Epilogue prompts ready', complete: true },
      ],
      steps: [
        {
          kind: 'scene',
          track: 'main',
          title: 'Cross the zero-gravity vault',
          durationMinutes: 45,
          visibility: 'shared',
          body: 'Characters navigate by jumping between fragments of the seven holds’ shared history.',
        },
        {
          kind: 'encounter',
          track: 'main',
          title: 'The astronomer awakens',
          durationMinutes: 90,
          visibility: 'dm-only',
          body: 'The guardian changes gravity, terrain, and its goal as three engine rings align.',
        },
        {
          kind: 'choice',
          track: 'main',
          title: 'Choose the fate of the vessel',
          durationMinutes: 35,
          visibility: 'shared',
          body: 'Launch, burial, and ignition each honor one promise and break at least one other.',
        },
        {
          kind: 'closing',
          track: 'main',
          title: 'Epilogues under a changed sky',
          durationMinutes: 30,
          visibility: 'shared',
          body: 'Ask each player what their character builds now that the holds must share a future.',
        },
      ],
      notes: [
        'Resolve faction promises before describing the cosmic result.',
        'The guardian can surrender once the party articulates a shared purpose.',
      ],
      playerFacingSummary:
        'The deep sky is opening. What waits beneath Kharad was built to carry a civilization—or burn one.',
    }),
  }),
];

const crownCharacters: PlayerCharacter[] = [
  {
    id: `${CROWN_ID}-pc-bryn`,
    name: 'Bryn Hearthward',
    ancestry: 'Dwarf',
    className: 'Paladin',
    level: 1,
    hook: 'Swore to protect the crown, not the person wearing it.',
  },
  {
    id: `${CROWN_ID}-pc-sable`,
    name: 'Sable Quill',
    ancestry: 'Tiefling',
    className: 'Bard',
    level: 1,
    hook: 'Ghostwrote speeches for all three heirs under different names.',
  },
  {
    id: `${CROWN_ID}-pc-ivo`,
    name: 'Ivo Reed',
    ancestry: 'Human',
    className: 'Rogue',
    level: 1,
    hook: 'Recognizes the assassin’s flame as a thieves’ guild signal.',
  },
];

const mourningfenCharacters: PlayerCharacter[] = [
  {
    id: `${MOURNINGFEN_ID}-pc-anna`,
    name: 'Anna Pike',
    ancestry: 'Human',
    className: 'Ranger',
    level: 4,
    hook: 'Can navigate every marsh trail except one erased from her map.',
  },
  {
    id: `${MOURNINGFEN_ID}-pc-corren`,
    name: 'Corren Moss',
    ancestry: 'Halfling',
    className: 'Druid',
    level: 4,
    hook: 'The reeds repeat a childhood nickname no living person knows.',
  },
  {
    id: `${MOURNINGFEN_ID}-pc-ves`,
    name: 'Ves Nymm',
    ancestry: 'Elf',
    className: 'Cleric',
    level: 4,
    hook: 'Keeps funeral records containing a blank page that cannot be marked.',
  },
  {
    id: `${MOURNINGFEN_ID}-pc-tallow`,
    name: 'Tallow',
    ancestry: 'Dragonborn',
    className: 'Sorcerer',
    level: 4,
    hook: 'Their magic burns blue near forgotten things.',
  },
];

const kharadCharacters: PlayerCharacter[] = [
  {
    id: `${KHARAD_ID}-pc-dagna`,
    name: 'Dagna Seven-Chalks',
    ancestry: 'Dwarf',
    className: 'Wizard',
    level: 10,
    hook: 'Her academic disgrace began with a correct theory about the deep sky.',
  },
  {
    id: `${KHARAD_ID}-pc-orik`,
    name: 'Orik Vaul',
    ancestry: 'Goliath',
    className: 'Fighter',
    level: 10,
    hook: 'Carries a survey hammer that vibrates near the buried transit line.',
  },
  {
    id: `${KHARAD_ID}-pc-nima`,
    name: 'Nima Ashglass',
    ancestry: 'Deep gnome',
    className: 'Artificer',
    level: 10,
    hook: 'Inherited one key to the engine and a warning never to use it.',
  },
  {
    id: `${KHARAD_ID}-pc-hale`,
    name: 'Hale-of-Echoes',
    ancestry: 'Orc',
    className: 'Cleric',
    level: 10,
    hook: 'Believes the constellation is a map left by their god.',
  },
];

function createAshesShowcasePlan(sessionNumber: 11 | 13): SessionPlan {
  if (sessionNumber === 11) {
    return createPlan({
      idPrefix: `${ashesCampaign.id}-showcase-session-11`,
      lastEdited: '1 week ago',
      readiness: [
        { label: 'Fishmongers’ Row fire map ready', complete: true },
        { label: 'Shipping ledger clues indexed', complete: true },
      ],
      steps: [
        {
          kind: 'recap',
          track: 'main',
          title: 'Contraband at customs',
          durationMinutes: 10,
          visibility: 'shared',
          body: 'Reconnect the false manifest to the Ashen Synod and establish who currently holds each copy.',
        },
        {
          kind: 'encounter',
          track: 'main',
          title: 'Fire on Fishmongers’ Row',
          durationMinutes: 55,
          visibility: 'dm-only',
          body: 'Run the blaze as a rescue clock while hired saboteurs try to destroy the ledger stall.',
        },
        {
          kind: 'handout',
          track: 'main',
          title: 'Recover the burned shipping ledger',
          durationMinutes: 15,
          visibility: 'shared',
          body: 'Reveal the Dawn Petrel, pier 6, and a delivery marked for the third bell.',
        },
        {
          kind: 'closing',
          track: 'main',
          title: 'Captain Serin asks for silence',
          durationMinutes: 15,
          visibility: 'shared',
          body: 'Serin warns that someone inside the Watch has already altered the official report.',
        },
      ],
      notes: [
        'Success is measured by people and evidence saved, not enemies defeated.',
      ],
      playerFacingSummary:
        'Smoke rises over Fishmongers’ Row, and the one ledger that could expose the smugglers is inside the fire.',
    });
  }

  return createPlan({
    idPrefix: `${ashesCampaign.id}-showcase-session-13`,
    lastEdited: '30 minutes ago',
    readiness: [
      { label: 'Flooded tunnel map ready', complete: true },
      { label: 'Ember Key reveal text reviewed', complete: false },
      { label: 'Synod escape route prepared', complete: false },
    ],
    steps: [
      {
        kind: 'recap',
        track: 'main',
        title: 'The third bell clue',
        durationMinutes: 10,
        visibility: 'shared',
        body: 'Review the ledger, the underwater bell, and the party’s current standing with the Harbor Watch.',
      },
      {
        kind: 'scene',
        track: 'main',
        title: 'Enter beneath the Customs House',
        durationMinutes: 35,
        visibility: 'shared',
        body: 'Low tide exposes a warded stair for only one hour; signs show another group entered first.',
      },
      {
        kind: 'encounter',
        track: 'main',
        title: 'Hold the flooded archive',
        durationMinutes: 65,
        visibility: 'dm-only',
        body: 'Rising water changes the battlefield each round while Synod agents attempt to remove a sealed reliquary.',
      },
      {
        kind: 'choice',
        track: 'main',
        title: 'Take the key or save the trapped agents',
        durationMinutes: 25,
        visibility: 'shared',
        body: 'The reliquary can be secured immediately, but doing so closes the only dry route to the wounded rivals.',
      },
      {
        kind: 'closing',
        track: 'main',
        title: 'The Hollow Crown answers',
        durationMinutes: 10,
        visibility: 'shared',
        body: 'When the Ember Key reaches open air, the bells beneath the bay answer in sequence.',
      },
    ],
    notes: [
      'This session bridges the catalog preview into the planned third act.',
    ],
    playerFacingSummary:
      'At low tide, a hidden stair opens beneath the Customs House—and someone has beaten you to the Ember Key.',
  });
}

const ashesShowcaseSessions = ashesSessions
  .filter((session) => [11, 12, 13].includes(session.number))
  .map((session) =>
    session.plan
      ? session
      : {
          ...session,
          plan: createAshesShowcasePlan(session.number === 11 ? 11 : 13),
        },
  );

export const campaignCatalog: CampaignCatalogEntry[] = [
  {
    slug: 'ashes-of-veyra',
    campaign: {
      id: ashesCampaign.id,
      name: ashesCampaign.title,
      description: ashesCampaign.premise,
      createdAt: '2025-01-04T15:00:00.000Z',
      updatedAt: '2025-04-24T18:00:00.000Z',
    },
    subtitle: ashesCampaign.subtitle,
    premise: ashesCampaign.premise,
    ruleset: 'D&D 5e',
    edition: '2014/2024 compatible',
    lifecycle: 'active',
    tier: 'tier-2',
    tags: ['Coastal fantasy', 'Faction intrigue', 'Mystery'],
    playerCharacters: ashesCampaign.playerCharacters,
    selectedSessionId: ashesCampaign.currentSessionId,
    showcaseSessions: ashesShowcaseSessions,
    fixtureSource: 'full-demo',
  },
  {
    slug: 'crown-of-cinders',
    campaign: {
      id: CROWN_ID,
      name: 'Crown of Cinders',
      description:
        'A court-intrigue starter campaign about a disputed crown that remembers every ruler it has burned.',
      createdAt: '2026-09-20T14:15:00.000Z',
      updatedAt: '2026-09-27T16:40:00.000Z',
    },
    subtitle: 'Three heirs. One crown. A kingdom already on fire.',
    premise:
      'The monarch dies without naming an heir, and the coronation crown awakens with accusations against all three claimants. During the investiture, elemental assassins force a band of unlikely witnesses to decide who can be trusted with the realm.',
    ruleset: 'D&D 5e',
    edition: '2024',
    lifecycle: 'draft',
    tier: 'tier-1',
    tags: ['Court intrigue', 'Elemental fantasy', 'Starter campaign'],
    playerCharacters: crownCharacters,
    selectedSessionId: crownSession.id,
    showcaseSessions: [crownSession],
    fixtureSource: 'catalog',
  },
  {
    slug: 'lanterns-of-mourningfen',
    campaign: {
      id: MOURNINGFEN_ID,
      name: 'Lanterns of Mourningfen',
      description:
        'A compact folk-horror mystery about stolen memories and the families a village chose to forget.',
      createdAt: '2026-07-28T19:00:00.000Z',
      updatedAt: '2026-08-28T21:10:00.000Z',
    },
    subtitle: 'The marsh keeps every name the village forgets.',
    premise:
      'A dead ferryman’s lantern returns to the water, guiding travelers toward a homestead absent from every map. The party must uncover why the village traded away a family’s memory—and decide whether remembering them will release something worse.',
    ruleset: 'D&D 5e',
    edition: '2014/2024 compatible',
    lifecycle: 'paused',
    tier: 'tier-1',
    tags: ['Folk horror', 'Marsh exploration', 'Moral choices'],
    playerCharacters: mourningfenCharacters,
    selectedSessionId: mourningfenSessions[1].id,
    showcaseSessions: mourningfenSessions,
    fixtureSource: 'catalog',
  },
  {
    slug: 'stars-below-kharad',
    campaign: {
      id: KHARAD_ID,
      name: 'Stars Below Kharad',
      description:
        'A high-tier dwarven science-fantasy expedition through an impossible constellation buried beneath seven holds.',
      createdAt: '2026-04-19T17:30:00.000Z',
      updatedAt: '2026-05-31T02:20:00.000Z',
    },
    subtitle: 'The oldest road points down, beyond stone and sky.',
    premise:
      'A mine collapse reveals an observatory aimed into the earth and a star engine linking seven rival holds. The heroes race to understand the machine before political ambition wakes its ancient custodian and turns a buried vessel into a weapon.',
    ruleset: 'D&D 5e',
    edition: '2014',
    lifecycle: 'complete',
    tier: 'tier-2',
    tags: ['Dwarven science fantasy', 'Underdark', 'Completed arc'],
    playerCharacters: kharadCharacters,
    selectedSessionId: kharadSessions[2].id,
    showcaseSessions: kharadSessions,
    fixtureSource: 'catalog',
  },
];

export function getCampaignCatalogEntry(
  campaignId: string,
): CampaignCatalogEntry | undefined {
  return campaignCatalog.find((entry) => entry.campaign.id === campaignId);
}

export function getCampaignCatalogEntryBySlug(
  slug: string,
): CampaignCatalogEntry | undefined {
  return campaignCatalog.find((entry) => entry.slug === slug);
}

export function getVisibleCampaignCatalog(
  mode: string = import.meta.env.MODE,
): CampaignCatalogEntry[] {
  return mode === 'development' || mode === 'test'
    ? campaignCatalog
    : campaignCatalog.filter((entry) => entry.fixtureSource === 'full-demo');
}

export function getCatalogSession(
  sessionId: string,
): CampaignSession | undefined {
  return campaignCatalog
    .flatMap((entry) => entry.showcaseSessions)
    .find((session) => session.id === sessionId);
}

export function inspectCampaignCatalog(): CatalogIntegrityIssue[] {
  const issues: CatalogIntegrityIssue[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();

  const addId = (path: string, id: string): void => {
    if (ids.has(id)) {
      issues.push({ path, reference: id, reason: 'duplicate-id' });
    }
    ids.add(id);
  };

  for (const [campaignIndex, entry] of campaignCatalog.entries()) {
    const campaignPath = `campaigns[${campaignIndex}]`;
    if (slugs.has(entry.slug)) {
      issues.push({
        path: `${campaignPath}.slug`,
        reference: entry.slug,
        reason: 'duplicate-id',
      });
    }
    slugs.add(entry.slug);
    addId(`${campaignPath}.campaign.id`, entry.campaign.id);

    for (const [field, value] of [
      ['createdAt', entry.campaign.createdAt],
      ['updatedAt', entry.campaign.updatedAt],
    ] as const) {
      if (Number.isNaN(Date.parse(value))) {
        issues.push({
          path: `${campaignPath}.campaign.${field}`,
          reference: value,
          reason: 'invalid-date',
        });
      }
    }

    if (
      entry.showcaseSessions.length < 1 ||
      entry.showcaseSessions.length > 3
    ) {
      issues.push({
        path: `${campaignPath}.showcaseSessions`,
        reference: String(entry.showcaseSessions.length),
        reason: 'invalid-session-count',
      });
    }

    if (
      !entry.showcaseSessions.some(
        (session) => session.id === entry.selectedSessionId,
      )
    ) {
      issues.push({
        path: `${campaignPath}.selectedSessionId`,
        reference: entry.selectedSessionId,
        reason: 'missing-selected-session',
      });
    }

    const sessionNumbers = new Set<number>();
    for (const [sessionIndex, session] of entry.showcaseSessions.entries()) {
      const sessionPath = `${campaignPath}.showcaseSessions[${sessionIndex}]`;
      addId(`${sessionPath}.id`, session.id);

      if (session.campaignId !== entry.campaign.id) {
        issues.push({
          path: `${sessionPath}.campaignId`,
          reference: session.campaignId,
          reason: 'campaign-mismatch',
        });
      }
      if (sessionNumbers.has(session.number)) {
        issues.push({
          path: `${sessionPath}.number`,
          reference: String(session.number),
          reason: 'duplicate-session-number',
        });
      }
      sessionNumbers.add(session.number);

      if (!session.plan) {
        issues.push({
          path: `${sessionPath}.plan`,
          reference: session.id,
          reason: 'missing-plan',
        });
        continue;
      }

      const duration = session.plan.steps.reduce(
        (total, step) => total + step.durationMinutes,
        0,
      );
      if (
        session.plan.estimatedMinutes <= 0 ||
        session.plan.estimatedMinutes < duration
      ) {
        issues.push({
          path: `${sessionPath}.plan.estimatedMinutes`,
          reference: String(session.plan.estimatedMinutes),
          reason: 'invalid-estimate',
        });
      }

      session.plan.steps.forEach((step, stepIndex) => {
        addId(`${sessionPath}.plan.steps[${stepIndex}].id`, step.id);
        if (step.order !== stepIndex + 1) {
          issues.push({
            path: `${sessionPath}.plan.steps[${stepIndex}].order`,
            reference: String(step.order),
            reason: 'invalid-step-order',
          });
        }
      });
      session.plan.readiness.forEach((item, itemIndex) =>
        addId(`${sessionPath}.plan.readiness[${itemIndex}].id`, item.id),
      );
    }

    entry.playerCharacters.forEach((character, characterIndex) =>
      addId(
        `${campaignPath}.playerCharacters[${characterIndex}].id`,
        character.id,
      ),
    );
  }

  return issues;
}
