import type { CampaignAct, CampaignFixture, FixtureId } from '../ashes-of-veyra/types';

export const CROWN_CAMPAIGN_ID = 'campaign-crown-of-cinders';

/** Session ids match the catalog entry: `<campaignId>-session-<n>`. */
export const crownSessionId = (number: number): FixtureId =>
  `${CROWN_CAMPAIGN_ID}-session-${number}`;

export const CROWN_SESSION_COUNT = 6;

export const crownActs: CampaignAct[] = [
  {
    id: `${CROWN_CAMPAIGN_ID}-act-1`,
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Act I: The Investiture',
    order: 1,
    status: 'active',
    firstSessionNumber: 1,
    lastSessionNumber: 2,
    summary:
      'A coronation ends in fire. The party meets the three heirs, survives the cinder assassins, and follows a thieves-guild flame signal into the Ashgate underworld.',
  },
  {
    id: `${CROWN_CAMPAIGN_ID}-act-2`,
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Act II: A Court of Knives',
    order: 2,
    status: 'planned',
    firstSessionNumber: 3,
    lastSessionNumber: 4,
    summary:
      'Money, oaths, and forged genealogies pull the heirs apart while the party learns what the crown remembers about the rulers it has burned.',
  },
  {
    id: `${CROWN_CAMPAIGN_ID}-act-3`,
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Act III: The Crown Remembers',
    order: 3,
    status: 'planned',
    firstSessionNumber: 5,
    lastSessionNumber: 6,
    summary:
      'The party descends beneath the Ember Cloister, confronts the Unquenched, and decides who, if anyone, is fit to wear the crown.',
  },
];

export const crownCampaign: CampaignFixture = {
  id: CROWN_CAMPAIGN_ID,
  title: 'Crown of Cinders',
  subtitle: 'Three heirs. One crown. A kingdom already on fire.',
  premise:
    'The monarch dies without naming an heir, and the coronation crown awakens with accusations against all three claimants. During the investiture, elemental assassins force a band of unlikely witnesses to decide who can be trusted with the realm.',
  ruleset: 'D&D 5e',
  edition: '2024',
  status: 'draft',
  currentSessionId: crownSessionId(1),
  actIds: crownActs.map((act) => act.id),
  sessionIds: Array.from({ length: CROWN_SESSION_COUNT }, (_, index) =>
    crownSessionId(index + 1),
  ),
  playerCharacters: [
    {
      id: `${CROWN_CAMPAIGN_ID}-pc-bryn`,
      name: 'Bryn Hearthward',
      ancestry: 'Dwarf',
      className: 'Paladin',
      level: 1,
      hook: 'Swore to protect the crown, not the person wearing it.',
    },
    {
      id: `${CROWN_CAMPAIGN_ID}-pc-sable`,
      name: 'Sable Quill',
      ancestry: 'Tiefling',
      className: 'Bard',
      level: 1,
      hook: 'Ghostwrote speeches for all three heirs under different names.',
    },
    {
      id: `${CROWN_CAMPAIGN_ID}-pc-ivo`,
      name: 'Ivo Reed',
      ancestry: 'Human',
      className: 'Rogue',
      level: 1,
      hook: 'Recognizes the assassin’s flame as a thieves’ guild signal.',
    },
  ],
  // Prep totals for the campaign so far (planned material counts as prepped).
  objectCounts: {
    all: 83,
    scenes: 6,
    encounters: 11,
    npcs: 16,
    lore: 7,
    handouts: 14,
  },
  nextSession: {
    sessionId: crownSessionId(1),
    plannedDate: 'Sat, Oct 3, 2026',
    time: '6-9 PM',
    relativeDate: 'in 4 days',
    encounterId: 'encounter-cinder-wights-dais',
    npcId: 'npc-the-crown',
    locationId: 'location-hall-of-nine-banners',
    questId: 'quest-who-wears-the-crown',
  },
  activity: {
    backlinks: [
      {
        id: 'backlink-the-crown',
        label: 'The Crown of Cinders',
        objectType: 'npc',
        targetId: 'npc-the-crown',
        detail: 'Sentient relic',
      },
      {
        id: 'backlink-hall-of-nine-banners',
        label: 'Hall of Nine Banners',
        objectType: 'location',
        targetId: 'location-hall-of-nine-banners',
        detail: 'Session 1 setting',
      },
      {
        id: 'backlink-cinder-wights-dais',
        label: 'Cinder Wights at the Dais',
        objectType: 'encounter',
        targetId: 'encounter-cinder-wights-dais',
        detail: 'Session 1 encounter',
      },
      {
        id: 'backlink-who-wears-the-crown',
        label: 'Who Wears the Crown',
        objectType: 'quest',
        targetId: 'quest-who-wears-the-crown',
        detail: 'High priority',
      },
      {
        id: 'backlink-royal-mausoleum',
        label: 'The Vellgrave Mausoleum',
        objectType: 'location',
        targetId: 'location-royal-mausoleum',
        detail: 'Session 4 setting, empty-coffin reveal',
      },
      {
        id: 'backlink-aurel-claimant',
        label: 'The Man Who Calls Himself Aurel',
        objectType: 'npc',
        targetId: 'npc-aurel-claimant',
        detail: 'Referenced by 3 handouts and 2 clues',
      },
      {
        id: 'backlink-queens-last-night',
        label: 'The Queen’s Last Night',
        objectType: 'quest',
        targetId: 'quest-queens-last-night',
        detail: 'High priority, linked to 4 clues',
      },
    ],
    recentEdits: [
      {
        id: 'edit-cinder-wights-dais',
        label: 'Cinder Wights at the Dais',
        objectType: 'encounter',
        targetId: 'encounter-cinder-wights-dais',
        detail: 'Encounter · 20 minutes ago',
      },
      {
        id: 'edit-corvin-vell',
        label: 'Prince Corvin Vell',
        objectType: 'npc',
        targetId: 'npc-corvin-vell',
        detail: 'NPC · 1 hour ago',
      },
      {
        id: 'edit-hall-of-nine-banners',
        label: 'Hall of Nine Banners',
        objectType: 'location',
        targetId: 'location-hall-of-nine-banners',
        detail: 'Location · 3 hours ago',
      },
      {
        id: 'edit-ember-wardens',
        label: 'The Ember Wardens',
        objectType: 'faction',
        targetId: 'faction-ember-wardens',
        detail: 'Faction · Yesterday',
      },
      {
        id: 'edit-ashgate-royal-quarter-map',
        label: 'Map: Ashgate Royal Quarter',
        objectType: 'map',
        targetId: 'map-ashgate-royal-quarter',
        detail: 'Map · Yesterday',
      },
      {
        id: 'edit-marcher-lords',
        label: 'The Marcher Lords',
        objectType: 'faction',
        targetId: 'faction-border-lords',
        detail: 'Faction · Added today',
      },
      {
        id: 'edit-witness-clause',
        label: 'The Witness Clause',
        objectType: 'encounter',
        targetId: 'encounter-witness-clause',
        detail: 'Encounter · Statted for session 6',
      },
      {
        id: 'edit-inkwell-court',
        label: 'Inkwell Court',
        objectType: 'location',
        targetId: 'location-inkwell-court',
        detail: 'Location · Mapped for session 3',
      },
    ],
  },
};
