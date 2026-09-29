import type { CampaignLocation } from '../ashes-of-veyra/types';
import { CROWN_CAMPAIGN_ID } from './campaign';

const MAP = 'map-ashgate-royal-quarter';

export const crownLocations: CampaignLocation[] = [
  {
    id: 'location-ashgate',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Ashgate',
    type: 'district',
    shortDescription:
      'The soot-dark capital of the realm, built around a hill of cooled volcanic glass.',
    description: [
      'Chimneys in every colour of smoke crowd the skyline. Lamplighters race the dusk from street to street.',
      'The royal quarter sits on the hill; the guild districts sprawl below, each with its own smell and its own arrangements.',
    ],
    tags: ['City', 'Capital', 'Court'],
    mapId: MAP,
    pinId: 'pin-hall-of-nine-banners',
    npcIds: ['npc-oswin-pell', 'npc-corvin-vell'],
    factionIds: [
      'faction-house-vell',
      'faction-gilded-ledger',
      'faction-soot-hands',
    ],
    encounterIds: [],
    questIds: ['quest-who-wears-the-crown'],
    handoutIds: ['lore-succession-law'],
    notes:
      'The city selector region; use district records for specific scenes and encounters.',
  },
  {
    id: 'location-hall-of-nine-banners',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Hall of Nine Banners',
    type: 'government',
    shortDescription:
      'The vaulted throne hall where the coronation is held, hung with one banner for each ruler the crown has burned.',
    description: [
      'Nine banners, eight of them faded. The ninth is the queen’s, and it is still bright.',
      'The dais stands at the north end, with braziers of ceremonial ash on either side.',
    ],
    tags: ['Throne hall', 'Session 1', 'Fire hazard'],
    mapId: MAP,
    pinId: 'pin-hall-of-nine-banners',
    npcIds: [
      'npc-corvin-vell',
      'npc-ysolde-vell',
      'npc-tamsin-vell',
      'npc-the-crown',
      'npc-courier-wren',
    ],
    factionIds: ['faction-house-vell', 'faction-ember-wardens'],
    encounterIds: [
      'encounter-cinder-wights-dais',
      'encounter-heirs-audience',
    ],
    questIds: [
      'quest-who-wears-the-crown',
      'quest-trace-the-cinder-assassins',
    ],
    handoutIds: [
      'handout-coronation-program',
      'handout-crown-voice-transcript',
      'handout-heir-relationship-cards',
    ],
    sceneTemplateId: 'scene-hall-of-nine-banners',
    notes:
      'Session 1 primary setting. Ballroom hazard map reviewed; the banners double as a three-round fire clock.',
  },
  {
    id: 'location-crown-vault',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'The Crown Vault',
    type: 'landmark',
    shortDescription:
      'A sealed chamber under the palace where the crown rests between coronations.',
    description: [
      'A round room lined with obsidian mirrors. The crown’s pedestal is scorched in a ring, nine layers deep.',
      'A stair on the far side leads down to an archive the Wardens have never admitted to opening.',
    ],
    tags: ['Vault', 'Session 4', 'Archive'],
    mapId: MAP,
    pinId: 'pin-crown-vault',
    npcIds: ['npc-the-crown', 'npc-tamsin-vell'],
    factionIds: ['faction-ember-wardens', 'faction-house-vell'],
    encounterIds: ['encounter-vault-guardians'],
    questIds: ['quest-crown-remembers'],
    handoutIds: ['lore-burned-rulers-roll'],
    sceneTemplateId: 'scene-crown-vault-template',
    notes: 'Unrun. The guardians can be disarmed if the crown is asked the right question.',
  },
  {
    id: 'location-ember-cloister',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'The Ember Cloister',
    type: 'landmark',
    shortDescription:
      'The Wardens’ stone fortress-monastery on the palace hill.',
    description: [
      'Sworn brothers and sisters tend perpetual braziers in the cloister court. Novices sweep the same ash every dawn.',
      'The lower levels connect to older cellars nobody explains.',
    ],
    tags: ['Warden order', 'Fortress', 'Archive'],
    mapId: MAP,
    pinId: 'pin-ember-cloister',
    npcIds: ['npc-halden-brack', 'npc-tamsin-vell', 'npc-corvin-vell'],
    factionIds: ['faction-ember-wardens', 'faction-unquenched'],
    encounterIds: [],
    questIds: ['quest-crown-remembers', 'quest-who-wears-the-crown'],
    handoutIds: [],
    notes:
      'Unrun. The archive contains a scratched three-flame mark that matches the Unquenched brand.',
  },
  {
    id: 'location-gilded-exchange',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'The Gilded Exchange',
    type: 'market',
    shortDescription:
      'The counting-house market where the realm’s debts are traded.',
    description: [
      'Brass-railed floors, chalkboards of rates, and clerks who never look up.',
      'A private gallery above the floor is where Oswin Pell does his real business.',
    ],
    tags: ['Market', 'Finance', 'Session 3'],
    mapId: MAP,
    pinId: 'pin-gilded-exchange',
    npcIds: ['npc-oswin-pell', 'npc-ysolde-vell'],
    factionIds: ['faction-gilded-ledger'],
    encounterIds: [],
    questIds: [
      'quest-who-wears-the-crown',
      'quest-dead-princes-genealogy',
    ],
    handoutIds: ['handout-sealed-genealogy'],
    notes: 'Unrun. Pell offers a contract for each faction the party visits.',
  },
  {
    id: 'location-guttered-candle',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'The Guttered Candle',
    type: 'tavern',
    shortDescription:
      'A smoky cellar tavern favoured by lamplighters and thieves.',
    description: [
      'The signboard is a candle with the flame snuffed. Every table has a lamp, and every lamp is a code.',
      'The cellar below is where the Soot Hands trade favours.',
    ],
    tags: ['Tavern', 'Soot Hands', 'Session 2'],
    mapId: MAP,
    pinId: 'pin-guttered-candle',
    npcIds: ['npc-nell-soot'],
    factionIds: ['faction-soot-hands'],
    encounterIds: ['encounter-guttered-candle-brawl'],
    questIds: ['quest-trace-the-cinder-assassins'],
    handoutIds: ['handout-flame-signal-sketch'],
    sceneTemplateId: 'scene-guttered-candle-cellar',
    notes: 'Session 2 anchor. Ivo’s history with the crew makes this a soft entry.',
  },
  {
    id: 'location-ashwater-quay',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Ashwater Quay',
    type: 'pier',
    shortDescription:
      'A grey-water pier where ferries carry ash barges out to the tidal flats.',
    description: [
      'The barges leave at dusk, low with cooled cinders. Ferrymen speak in murmurs.',
      'The genealogy courier was last seen boarding here.',
    ],
    tags: ['Pier', 'Barges', 'Smuggling'],
    mapId: MAP,
    pinId: 'pin-ashwater-quay',
    npcIds: ['npc-nell-soot', 'npc-courier-wren'],
    factionIds: ['faction-soot-hands'],
    encounterIds: [],
    questIds: [
      'quest-trace-the-cinder-assassins',
      'quest-dead-princes-genealogy',
    ],
    handoutIds: ['handout-flame-signal-sketch'],
    notes: 'Unrun. Good location for a chase if session 2 goes quickly.',
  },
  {
    id: 'location-ashen-catacombs',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'The Ashen Catacombs',
    type: 'landmark',
    shortDescription:
      'Cooled lava tubes beneath the Cloister where the Unquenched hold their rites.',
    description: [
      'The walls glitter with black glass. The air tastes of struck flint.',
      'A rite pit glows at the centre of the largest chamber, ringed with branded cultists.',
    ],
    tags: ['Dungeon', 'Unquenched', 'Session 5'],
    mapId: MAP,
    pinId: 'pin-ashen-catacombs',
    npcIds: ['npc-mother-cinder'],
    factionIds: ['faction-unquenched'],
    encounterIds: ['encounter-catacomb-ashbound'],
    questIds: ['quest-trace-the-cinder-assassins'],
    handoutIds: ['lore-unquenched-creed'],
    notes:
      'Unrun. The party should reach it only after the paymaster trail has been followed.',
  },
];
