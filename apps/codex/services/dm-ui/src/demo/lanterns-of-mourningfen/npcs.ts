import type { CampaignNpc } from '../ashes-of-veyra/types';
import { MOURNINGFEN_CAMPAIGN_ID, mourningfenSessionId as s } from './campaign';

export const npcs: CampaignNpc[] = [
  {
    id: 'npc-hesper-crane',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Reeve Hesper Crane',
    role: 'Village reeve, Lantern Warden',
    ancestry: 'Human',
    factionIds: ['faction-lantern-wardens'],
    motivation:
      'Keep the bargain intact. She believes the forgetting is the only thing that has kept the fen fever from returning.',
    relationship:
      'Courteous and helpful on the surface; has asked the party twice to "leave the old homestead to the water." Confrontation is unresolved.',
    locationIds: ['location-mourningfen-village', 'location-wardens-lamp-house'],
    sessionIds: [s(1), s(2), s(3)],
    portraitFallback: 'HC',
    tags: ['Reeve', 'Bargain keeper', 'Tension unresolved'],
  },
  {
    id: 'npc-odo-tarn',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Odo Tarn',
    role: 'Dead ferryman, lantern bearer',
    ancestry: 'Human',
    factionIds: ['faction-reedbound'],
    motivation:
      'Finish the crossing he was making the night he drowned: deliver someone to the Verrow landing.',
    relationship:
      'Silent guide. Answers only with the lantern; brightens when the party speaks a Verrow name aloud.',
    locationIds: ['location-crossing-ferry-landing', 'location-drowned-shrine'],
    sessionIds: [s(1), s(3)],
    portraitFallback: 'OT',
    tags: ['Ghost', 'Guide', 'Unfinished business'],
  },
  {
    id: 'npc-bettin-sallow',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Bettin Sallow',
    role: 'Keeper of the Tidewake Burial Society',
    ancestry: 'Halfling',
    factionIds: ['faction-burial-society'],
    motivation:
      'Protect the funeral rolls, and her own conscience, from a truth she helped bury as a girl.',
    relationship:
      'Recognized the blank page in Ves Nymm’s records and went quiet. Has not yet agreed to open the archive.',
    locationIds: ['location-mourningfen-village'],
    sessionIds: [s(1), s(3)],
    portraitFallback: 'BS',
    tags: ['Archivist', 'Guilty', 'Blocked thread'],
  },
  {
    id: 'npc-pim-verrow',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Pim Verrow',
    role: 'Youngest child of the erased family',
    ancestry: 'Human',
    factionIds: ['faction-reedbound'],
    motivation:
      'Finish the counting rhyme, and be counted. He keeps stopping one verse short.',
    relationship:
      'Curious and trusting; drawn to Corren Moss because the reeds already use his nickname.',
    locationIds: ['location-verrow-homestead', 'location-homestead-nursery'],
    sessionIds: [s(1), s(2)],
    portraitFallback: 'PV',
    tags: ['Ghost child', 'Counting rhyme', 'Session 2 anchor'],
  },
  {
    id: 'npc-ysolde-verrow',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Ysolde Verrow',
    role: 'Matriarch of the Reedbound procession',
    ancestry: 'Human',
    factionIds: ['faction-reedbound'],
    motivation:
      'Recover the seven names taken from her family without releasing what the village traded them to.',
    relationship:
      'Wary ally. Spared the party in session 1 after Anna spoke her name from the drowned shrine stones.',
    locationIds: ['location-drowned-shrine', 'location-verrow-homestead'],
    sessionIds: [s(1), s(2)],
    portraitFallback: 'YV',
    tags: ['Ghost', 'Matriarch', 'Wary ally'],
  },
  {
    id: 'npc-dunmore-fenn',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Dunmore Fenn',
    role: 'Eel-drover captain',
    ancestry: 'Half-orc',
    factionIds: ['faction-fenfolk-drovers'],
    motivation:
      'Get his crews out of a marsh that has been quietly taking their memories for years.',
    relationship:
      'Blunt ally in waiting. Has offered guides and boats if the party can prove the tithe is real.',
    locationIds: ['location-eel-market', 'location-reedcutters-rest'],
    sessionIds: [s(1), s(3)],
    portraitFallback: 'DF',
    tags: ['Drover', 'Potential ally', 'Wants proof'],
  },
  {
    id: 'npc-tamsin-reed',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Tamsin Reed',
    role: 'Apprentice lamp-keeper',
    ancestry: 'Human',
    factionIds: ['faction-lantern-wardens'],
    motivation:
      'She has counted the lamp oil and the tithe tally and the numbers do not agree. She is afraid to say so.',
    relationship:
      'Slipped a folded tally to the party and then avoided them. A crack in the Wardens the party has not yet used.',
    locationIds: ['location-wardens-lamp-house'],
    sessionIds: [s(1), s(3)],
    portraitFallback: 'TR',
    tags: ['Whistleblower', 'Frightened', 'Loose thread'],
  },
  {
    id: 'npc-goody-ashby',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Goody Marrow Ashby',
    role: 'Innkeeper of the Reedcutters’ Rest',
    ancestry: 'Human',
    factionIds: ['faction-fenfolk-drovers'],
    motivation:
      'Keep a warm room and a full table for anyone who walks in out of the fen, and not ask why the sixth chair is always empty.',
    relationship:
      'Friendly rumor source. Sets a place for a family she cannot name.',
    locationIds: ['location-reedcutters-rest', 'location-mourningfen-village'],
    sessionIds: [s(1)],
    portraitFallback: 'GA',
    tags: ['Innkeeper', 'Rumors', 'Empty chair'],
  },
  {
    id: 'npc-the-eighth-voice',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'The Eighth Voice',
    role: 'Whatever answers beneath the Verrow well',
    ancestry: 'Unknown',
    factionIds: ['faction-mere-below'],
    motivation:
      'To be named. The bargain paid for the village’s safety with a family’s memory and left the payee without a name of its own.',
    relationship:
      'Not yet met. Has spoken only through the last verse of the counting rhyme.',
    locationIds: ['location-verrow-well'],
    sessionIds: [s(2), s(4)],
    portraitFallback: 'EV',
    tags: ['Unknown entity', 'Set piece', 'Session 4 antagonist'],
  },
];
