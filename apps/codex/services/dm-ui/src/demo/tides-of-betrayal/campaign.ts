import type { CampaignAct, CampaignFixture, FixtureId } from '../ashes-of-veyra/types';

export const TIDES_CAMPAIGN_ID = 'campaign-tides-of-betrayal';

/** Session ids match the catalog entry: `<campaignId>-session-<n>`. */
export const tidesSessionId = (number: number): FixtureId =>
  `${TIDES_CAMPAIGN_ID}-session-${number}`;

export const TIDES_SESSION_COUNT = 8;

export const tidesActs: CampaignAct[] = [
  {
    id: `${TIDES_CAMPAIGN_ID}-act-1`,
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'Act I: Whispers in the Harbor',
    order: 1,
    status: 'active',
    firstSessionNumber: 1,
    lastSessionNumber: 3,
    summary:
      'A pirate attack on the Merchant Council’s spring fleet leaves Merrowgate on edge. The party follows rumors through the Dock Ward, decodes an old sea shanty to find a hidden cove, and learns the attack was an inside job paid for by someone on the Council.',
  },
  {
    id: `${TIDES_CAMPAIGN_ID}-act-2`,
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'Act II: Blood in the Water',
    order: 2,
    status: 'planned',
    firstSessionNumber: 4,
    lastSessionNumber: 6,
    summary:
      'The trail leads under the docks to a smugglers’ market, then out to sea aboard Elara’s ship. A bribed crew, a sahuagin raid and a parley with the pirate captain who was betrayed too reveal what the traitor really wants: the Tidecaller Pearl.',
  },
  {
    id: `${TIDES_CAMPAIGN_ID}-act-3`,
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'Act III: The Tidecaller’s Wake',
    order: 3,
    status: 'planned',
    firstSessionNumber: 7,
    lastSessionNumber: 8,
    summary:
      'The party dives into the drowned Sunken Spire for the Pearl, then races home as Councilor Vael turns the tides on Merrowgate during the Harbor Festival to make herself its savior.',
  },
];

export const tidesCampaign: CampaignFixture = {
  id: TIDES_CAMPAIGN_ID,
  title: 'Tides of Betrayal',
  subtitle: 'A city on edge, a fleet on the seabed, and a traitor on the Council.',
  premise:
    'Merrowgate stretches along a sprawling harbor where the sea breeze carries the scent of salt and opportunity. When pirates sink half of the Merchant Council’s spring fleet, whispers say it was no random attack. A band of new adventurers follows a sea shanty to a hidden cove, a smugglers’ market and a drowned temple, uncovering a betrayal among the city’s elite and a lost treasure that can command the tides. Eight chapters take characters from level 1 to 5.',
  ruleset: 'D&D 5e',
  edition: '2014/2024 compatible',
  mode: 'campaign',
  status: 'active',
  currentSessionId: tidesSessionId(3),
  actIds: tidesActs.map((act) => act.id),
  sessionIds: Array.from({ length: TIDES_SESSION_COUNT }, (_, index) =>
    tidesSessionId(index + 1),
  ),
  playerCharacters: [
    {
      id: `${TIDES_CAMPAIGN_ID}-pc-marisol`,
      name: 'Marisol Brightwater',
      ancestry: 'Human',
      className: 'Fighter',
      level: 3,
      hook: 'Marine on the fleet’s escort ship; she swam home while her shipmates drowned.',
    },
    {
      id: `${TIDES_CAMPAIGN_ID}-pc-quill`,
      name: 'Quill Fennick',
      ancestry: 'Halfling',
      className: 'Rogue',
      level: 3,
      hook: 'Grew up picking pockets in the Dock Ward and still owes favors to half of it.',
    },
    {
      id: `${TIDES_CAMPAIGN_ID}-pc-thessaly`,
      name: 'Thessaly Ardent',
      ancestry: 'Half-elf',
      className: 'Bard',
      level: 3,
      hook: 'Collects old sea shanties and first heard the Siren’s Call from her grandmother.',
    },
    {
      id: `${TIDES_CAMPAIGN_ID}-pc-oren`,
      name: 'Brother Oren Saltmarsh',
      ancestry: 'Dwarf',
      className: 'Cleric (Tempest)',
      level: 3,
      hook: 'Sent by the storm shrine because the sea has been restless since the attack.',
    },
  ],
  // Prep totals: scenes count locations, then encounters, NPCs, lore,
  // handouts, quests, factions and clues (the fixture test checks the sum).
  objectCounts: {
    all: 99,
    scenes: 14,
    encounters: 16,
    npcs: 18,
    lore: 8,
    handouts: 15,
  },
  nextSession: {
    sessionId: tidesSessionId(3),
    plannedDate: 'Sat, Oct 31, 2026',
    time: '6-10 PM',
    relativeDate: 'in 8 days',
    encounterId: 'encounter-council-masque',
    npcId: 'npc-seraphine-vael',
    locationId: 'location-council-hall',
    questId: 'quest-traitor-on-the-council',
  },
  activity: {
    backlinks: [
      {
        id: 'backlink-seraphine-vael',
        label: 'Councilor Seraphine Vael',
        objectType: 'npc',
        targetId: 'npc-seraphine-vael',
        detail: 'Referenced by 4 clues and 3 handouts',
      },
      {
        id: 'backlink-elara-tideborne',
        label: 'Captain Elara Tideborne',
        objectType: 'npc',
        targetId: 'npc-elara-tideborne',
        detail: 'Patron, appears in 6 sessions',
      },
      {
        id: 'backlink-sirens-cove',
        label: 'Siren’s Cove',
        objectType: 'location',
        targetId: 'location-sirens-cove',
        detail: 'Session 2 setting, pirates’ landing point',
      },
      {
        id: 'backlink-council-masque',
        label: 'The Midsummer Masque',
        objectType: 'encounter',
        targetId: 'encounter-council-masque',
        detail: 'Session 3 encounter',
      },
      {
        id: 'backlink-traitor-on-the-council',
        label: 'The Traitor on the Council',
        objectType: 'quest',
        targetId: 'quest-traitor-on-the-council',
        detail: 'High priority, linked to 5 clues',
      },
      {
        id: 'backlink-red-tide',
        label: 'The Red Tide',
        objectType: 'faction',
        targetId: 'faction-red-tide',
        detail: 'Opposition, linked to 4 encounters',
      },
      {
        id: 'backlink-merrowgate-harbor',
        label: 'Map: Merrowgate Harbor',
        objectType: 'map',
        targetId: 'map-merrowgate-harbor',
        detail: '9 pinned locations',
      },
    ],
    recentEdits: [
      {
        id: 'edit-council-masque',
        label: 'The Midsummer Masque',
        objectType: 'encounter',
        targetId: 'encounter-council-masque',
        detail: 'Encounter · 1 hour ago',
      },
      {
        id: 'edit-seraphine-vael',
        label: 'Councilor Seraphine Vael',
        objectType: 'npc',
        targetId: 'npc-seraphine-vael',
        detail: 'NPC · 2 hours ago',
      },
      {
        id: 'edit-council-hall',
        label: 'Council Hall',
        objectType: 'location',
        targetId: 'location-council-hall',
        detail: 'Location · Yesterday',
      },
      {
        id: 'edit-traitor-on-the-council',
        label: 'The Traitor on the Council',
        objectType: 'quest',
        targetId: 'quest-traitor-on-the-council',
        detail: 'Quest · Yesterday',
      },
      {
        id: 'edit-counting-house-vault',
        label: 'The Counting House Vault',
        objectType: 'encounter',
        targetId: 'encounter-counting-house-vault',
        detail: 'Encounter · 2 days ago',
      },
      {
        id: 'edit-house-vael',
        label: 'The Gull and Coin',
        objectType: 'faction',
        targetId: 'faction-gull-and-coin',
        detail: 'Faction · 3 days ago',
      },
      {
        id: 'edit-sirens-cove',
        label: 'Siren’s Cove',
        objectType: 'location',
        targetId: 'location-sirens-cove',
        detail: 'Location · Session 2 notes added',
      },
    ],
  },
};
