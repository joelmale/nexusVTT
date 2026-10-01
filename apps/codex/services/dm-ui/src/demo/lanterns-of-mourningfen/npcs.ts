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
  {
    id: 'npc-marl-quillon',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Marl Quillon',
    role: 'Hedge-herbalist and midwife',
    ancestry: 'Forest gnome',
    factionIds: ['faction-marrowbone-circle'],
    motivation:
      'Keep her patients alive and their days intact. She has been quietly treating drovers for lost years with a bitter reed tea and a lot of patience, and she is the only one who has written down what is missing.',
    relationship:
      'Not yet met. She sells remedies at the edge of the eel market, and Dunmore Fenn has already offered to introduce the party if they stop asking the Wardens for answers.',
    locationIds: ['location-eel-market', 'location-verrow-kitchen'],
    sessionIds: [s(3)],
    portraitFallback: 'MQ',
    tags: ['Herbalist', 'Remedies', 'Keeper of the other ledger'],
  },
  {
    id: 'npc-fenwick-oar',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Fenwick Oar',
    role: 'Gravedigger and slate-cutter',
    ancestry: 'Tiefling',
    factionIds: ['faction-burial-society'],
    motivation:
      'Lay the unnamed row to rest properly. He hears digging beneath it at dusk and has carved seven blank slates because he cannot bring himself to cut a name he does not know.',
    relationship:
      'Courteous, nervous, and unusually honest. He is the one Society member who would open the archive if Bettin asked him to, and she has not.',
    locationIds: [
      'location-tidewake-burying-ground',
      'location-tidewake-burial-hall',
    ],
    sessionIds: [s(3)],
    portraitFallback: 'FO',
    tags: ['Gravedigger', 'Honest', 'Hears digging'],
  },
  {
    id: 'npc-sabine-vale',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Circuit Clerk Sabine Vale',
    role: 'Clerk of the Greywater Assize',
    ancestry: 'Human',
    factionIds: ['faction-greywater-assize'],
    motivation:
      'Audit a village whose tax rolls show too few dead and too many births. She does not believe in ghosts, and is prepared to find a human fraud instead.',
    relationship:
      'Expected but not yet arrived. A letter in her hand has already reached the reeve, and the reeve has already burned it.',
    locationIds: ['location-mourningfen-village'],
    sessionIds: [s(3), s(4)],
    portraitFallback: 'SV',
    tags: ['Outsider', 'Auditor', 'Writ-bearer'],
  },
  {
    id: 'npc-ottoline-verrow',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Granny Ottoline Verrow',
    role: 'Grandam of the erased family; the house’s warmth',
    ancestry: 'Human',
    factionIds: ['faction-reedbound'],
    motivation:
      'Feed whoever walks in out of the cold, and keep every child in the house in sight. She counts the seven at the table and cannot understand why the eighth chair is always full.',
    relationship:
      'Neither hostile nor friendly until addressed by name. If given tea and her true name, she will say what the village signed, and who held the pen.',
    locationIds: ['location-verrow-kitchen', 'location-verrow-hall'],
    sessionIds: [s(2)],
    portraitFallback: 'OV',
    tags: ['Ghost', 'Grandam', 'Knows the signatories'],
  },
  {
    id: 'npc-halloran-wick',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Halloran Wick',
    role: 'Senior lamp-trimmer and the reeve’s enforcer',
    ancestry: 'Dwarf',
    factionIds: ['faction-lantern-wardens'],
    motivation:
      'Do what the reeve cannot say aloud. He believes in the bargain without fully knowing what it is, and he fears what the village would do if it learned.',
    relationship:
      'Watched the party leave the lamp house in session 1 and has been walking the boardwalk behind them since. Polite, and prepared to be otherwise.',
    locationIds: ['location-wardens-lamp-house', 'location-lantern-oil-cellar'],
    sessionIds: [s(1), s(3)],
    portraitFallback: 'HW',
    tags: ['Enforcer', 'Believer', 'Tail'],
  },
  {
    id: 'npc-maudlin-tarn',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Maudlin Tarn',
    role: 'Odo Tarn’s widow; lamp-trimmer at the ferry',
    ancestry: 'Human',
    factionIds: ['faction-lantern-wardens'],
    motivation:
      'Learn who her husband was carrying the night he drowned, and why the Wardens fined her for the lost fare.',
    relationship:
      'Distant and exact. She lights a candle at Odo’s grave each dusk and will speak if someone brings the lantern tag home with respect.',
    locationIds: [
      'location-tidewake-burying-ground',
      'location-crossing-ferry-landing',
    ],
    sessionIds: [s(1), s(3)],
    portraitFallback: 'MT',
    tags: ['Widow', 'Witness', 'Ferry ledger keeper'],
  },
  {
    id: 'npc-jun-fenn',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Jun Fenn',
    role: 'Dunmore’s niece, boat-runner',
    ancestry: 'Half-orc',
    factionIds: ['faction-fenfolk-drovers'],
    motivation:
      'Prove that the thing she hears in the reeds at night is real. She has known the counting rhyme since she was five and has never been able to say where she learned it.',
    relationship:
      'Quick, curious, and unafraid. She offered to guide Corren Moss through the channels and then vanished into the market before an answer was given.',
    locationIds: ['location-eel-market', 'location-reedwalk'],
    sessionIds: [s(1), s(3)],
    portraitFallback: 'JF',
    tags: ['Child', 'Guide', 'Knows the rhyme'],
  },
];
