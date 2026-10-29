import type { CampaignEncounter } from '../ashes-of-veyra/types';
import { MOURNINGFEN_CAMPAIGN_ID, mourningfenSessionId as s } from './campaign';

const DIFFICULTY_NOTE =
  'Display difficulty is a fixture. Creatures use compatible 2014 SRD definitions in this 2014/2024-compatible campaign; marsh spirits use the closest SRD spirit stat blocks as stand-ins.';

export const encounters: CampaignEncounter[] = [
  {
    id: 'encounter-lantern-loop',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'The Repeating Path',
    kind: 'combat-exploration',
    difficulty: 'low',
    composition: [
      {
        name: "Will-o'-Wisp",
        count: 1,
        ruleset: '2014-srd',
        role: 'Mimics the ferryman’s lantern and draws the party off the path.',
      },
      {
        name: 'Giant Frog',
        count: 3,
        ruleset: '2014-srd',
        role: 'Ambush from the reeds at each repeat of the landmarks.',
      },
    ],
    trigger:
      'The party passes the same three landmarks a second time without giving anything up at the shrine.',
    intendedUse:
      'Session 1 pressure beat; teaches that the fen bargains rather than tires.',
    sessionIds: [s(1)],
    locationIds: ['location-crossing-ferry-landing', 'location-drowned-shrine'],
    factionIds: ['faction-reedbound'],
    tactics:
      'The wisp retreats over deep water when hurt. The frogs flee when it is destroyed.',
    rulesetNotes: DIFFICULTY_NOTE,
  },
  {
    id: 'encounter-reedbound-procession',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'The Reedbound Procession',
    kind: 'social',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Ghost',
        count: 1,
        ruleset: '2014-srd',
        role: 'Leads the procession and decides whether to speak.',
      },
      {
        name: 'Shadow',
        count: 6,
        ruleset: '2014-srd',
        role: 'Lantern-bearing spirits that circle rather than strike unless a name is used against them.',
      },
    ],
    trigger:
      'The party reaches the drowned shrine at dusk and speaks or withholds a name.',
    intendedUse:
      'Session 1 set piece; resolved by speaking a Verrow name aloud. The party appeased the procession and was led to the homestead.',
    sessionIds: [s(1)],
    locationIds: ['location-drowned-shrine', 'location-verrow-homestead'],
    factionIds: ['faction-reedbound'],
    tactics:
      'If attacked, the Mourners Frighten and withdraw. They resume the walk the next dusk.',
    rulesetNotes:
      'Social difficulty is a display fixture, not a rules calculation. Reedbound mourners use the SRD Shadow as a stand-in.',
  },
  {
    id: 'encounter-shifting-rooms',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'The Shifting Rooms',
    kind: 'combat-hazard',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Specter',
        count: 1,
        ruleset: '2014-srd',
        role: 'Slams doors and drops the floor plan into the wrong loop. Stat line not yet adjusted for level 4.',
      },
      {
        name: 'Will-o\'-Wisp',
        count: 3,
        ruleset: '2014-srd',
        role: 'Copies a character’s surrendered memory as an attack.',
      },
    ],
    trigger:
      'A mirror is covered or a room is entered out of family order.',
    intendedUse:
      'Session 2 hazard; prep paused before the poltergeist and wisp numbers were reviewed.',
    sessionIds: [s(2)],
    locationIds: ['location-verrow-homestead', 'location-homestead-nursery'],
    factionIds: ['faction-reedbound'],
    tactics:
      'The rooms reset to the last portrait restored. Hazard resolves when the loop is solved.',
    rulesetNotes:
      'The poltergeist uses the SRD Specter and the reflection wisps use the SRD wisp stat block as stand-ins. Difficulty is a display fixture.',
  },
  {
    id: 'encounter-well-whisperer',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'What Answers From the Well',
    kind: 'combat',
    difficulty: 'high',
    composition: [
      {
        name: 'Wraith',
        count: 1,
        ruleset: '2014-srd',
        role: 'Takes memories instead of hit points on a failed save. Named or sealed, it reacts.',
      },
      {
        name: 'Shadow',
        count: 2,
        ruleset: '2014-srd',
        role: 'Drawn from the well by the party’s surrendered memories.',
      },
    ],
    trigger:
      'The party names the eighth verse aloud or attempts to seal the well.',
    intendedUse:
      'Session 4 finale for Act I. Outcome depends on the choice left unresolved when the campaign paused.',
    sessionIds: [s(2), s(4)],
    locationIds: ['location-verrow-well'],
    factionIds: ['faction-mere-below'],
    tactics:
      'It bargains first and attacks only once refused. Sealing removes its reach but leaves the tithe unpaid.',
    rulesetNotes:
      'The Eighth Voice uses the SRD Wraith as a stand-in. Difficulty is a display fixture.',
  },
  {
    id: 'encounter-warden-lamp-patrol',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Warden Lamp Patrol',
    kind: 'combat',
    difficulty: 'low',
    composition: [
      {
        name: 'Guard',
        count: 3,
        ruleset: '2014-srd',
        role: 'Warden volunteers who carry blue lamps and escort travelers away from the fen.',
      },
      {
        name: 'Scout',
        count: 1,
        ruleset: '2014-srd',
        role: 'Runs ahead to the lamp house to warn the reeve.',
      },
    ],
    trigger:
      'The party is caught near the lamp house after dusk with Tamsin’s tally.',
    intendedUse:
      'Session 3 option; most groups will talk rather than fight. Not prepared beyond a stat list.',
    sessionIds: [s(3)],
    locationIds: ['location-wardens-lamp-house', 'location-mourningfen-village'],
    factionIds: ['faction-lantern-wardens'],
    tactics:
      'The Wardens want the tally back, not a fight. They yield if Tamsin is named as the source.',
    rulesetNotes: DIFFICULTY_NOTE,
  },
  {
    id: 'encounter-drover-standoff',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Drover Standoff at the Eel Market',
    kind: 'social',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Veteran',
        count: 1,
        ruleset: '2014-srd',
        role: 'Demands proof the tithe is real before he commits his crews.',
      },
      {
        name: 'Commoner',
        count: 8,
        ruleset: '2014-srd',
        role: 'Drovers and market families; the crowd that decides whether to believe the party.',
      },
    ],
    trigger:
      'The party publicly repeats the tally at the eel market and Wardens are in the crowd.',
    intendedUse:
      'Session 3 social beat that decides whether the drovers become allies or leave the fen.',
    sessionIds: [s(3)],
    locationIds: ['location-eel-market', 'location-reedcutters-rest'],
    factionIds: ['faction-fenfolk-drovers', 'faction-lantern-wardens'],
    tactics:
      'Dunmore backs whoever shows him a number that does not add up. Wardens counter with kindness and reasonable doubt.',
    rulesetNotes:
      'Social difficulty is a display fixture, not a rules calculation.',
  },
  {
    id: 'encounter-sixth-chair-supper',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Supper at the Sixth Chair',
    kind: 'social',
    difficulty: 'low',
    composition: [
      {
        name: 'Commoner',
        count: 6,
        ruleset: '2014-srd',
        role: 'Regulars at the long table, each unaware that they are passing the bread to an empty chair.',
      },
      {
        name: 'Specter',
        count: 1,
        ruleset: '2014-srd',
        role: 'Stand-in for the unseen diner. It does nothing unless someone sits in its chair.',
      },
    ],
    trigger:
      'A character sits in the sixth chair at the long table, or asks the room who it is for.',
    intendedUse:
      'Session 1 flavour scene, played at the Reedcutters’ Rest. Establishes that the village remembers a seat but not a face.',
    sessionIds: [s(1)],
    locationIds: ['location-reedcutters-rest'],
    factionIds: ['faction-fenfolk-drovers'],
    tactics:
      'The Specter never attacks. It cools the room by a degree each round and the regulars grow quiet and stare at their hands.',
    rulesetNotes:
      'Social display fixture. The Specter is the SRD stand-in for a silent, seated presence; do not roll initiative.',
  },
  {
    id: 'encounter-oil-cellar-sneak',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'The Oil Cellar After Dark',
    kind: 'combat-exploration',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Guard',
        count: 2,
        ruleset: '2014-srd',
        role: 'Wardens on cellar watch, armed with oil lamps and short truncheons.',
      },
      {
        name: 'Swarm of Rats',
        count: 2,
        ruleset: '2014-srd',
        role: 'Disturbed from the flask racks when anything is knocked over.',
      },
      {
        name: 'Oil spill (hazard)',
        count: 1,
        ruleset: 'custom',
        role: 'A blue-stained floor that ignites in a flash if a lantern falls. 2d6 fire to anyone within 10 feet.',
        nonCreature: true,
      },
    ],
    trigger:
      'The party enters the cellar by the barge channel or follows Tamsin down the stairs after hours.',
    intendedUse:
      'Session 3 stealth-and-hazard beat. Reward quiet play and a plan for the lamps; punish carelessness.',
    sessionIds: [s(3)],
    locationIds: ['location-lantern-oil-cellar', 'location-wardens-lamp-house'],
    factionIds: ['faction-lantern-wardens'],
    tactics:
      'The guards call for Halloran Wick rather than press the fight. The rats scatter and re-form if anyone breaks a flask.',
    rulesetNotes:
      'Hazard row is a custom fire effect, not an SRD creature. Difficulty is a display fixture.',
  },
  {
    id: 'encounter-unnamed-dead',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'The Unnamed Row',
    kind: 'combat',
    difficulty: 'high',
    composition: [
      {
        name: 'Zombie',
        count: 5,
        ruleset: '2014-srd',
        role: 'The slow, upright dead of the blank slates, rising from clay that was filled in a hurry.',
      },
      {
        name: 'Ghoul',
        count: 1,
        ruleset: '2014-srd',
        role: 'A hungry thing that learned to wear a gravedigger’s patience.',
      },
    ],
    trigger:
      'The party disturbs the blank slates on the night of the tithe or tries to read the unmarked row.',
    intendedUse:
      'Session 3 optional set piece. The dead rise only if someone says the wrong name over them; a correct, kind word lays them back down.',
    sessionIds: [s(3)],
    locationIds: ['location-tidewake-burying-ground'],
    factionIds: ['faction-burial-society'],
    tactics:
      'The zombies move in a ring and do not pursue past the consecrated ground. The ghoul lingers behind them, hunting the character who spoke the name.',
    rulesetNotes:
      'Zombies and ghoul are SRD stand-ins for the unburied. Consecrated ground confers no extra rule; treat it as a retreat line.',
  },
  {
    id: 'encounter-reedwalk-sinkholes',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Quicksilt on the Reedwalk',
    kind: 'combat-hazard',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Quicksilt pool (hazard)',
        count: 3,
        ruleset: 'custom',
        role: 'A shallow, pewter-bright sink that pulls a creature down 1 foot per round. DC 13 Strength to climb free.',
        nonCreature: true,
      },
      {
        name: 'Crocodile',
        count: 1,
        ruleset: '2014-srd',
        role: 'Lurks near the second landmark and drags anyone who stops moving.',
      },
      {
        name: 'Giant Frog',
        count: 2,
        ruleset: '2014-srd',
        role: 'Lunge from the reeds and swallow small creatures.',
      },
    ],
    trigger:
      'The party leaves the lantern’s path on the Reedwalk or splits up to find the third landmark.',
    intendedUse:
      'Wilderness hazard for any return trip through the fen. Keeps travel tense after the first memory toll has been paid.',
    sessionIds: [s(1), s(3)],
    locationIds: ['location-reedwalk'],
    factionIds: ['faction-reedbound'],
    tactics:
      'The crocodile does not give chase beyond the reed line. The frogs scatter if the crocodile is slain.',
    rulesetNotes:
      'The pools are a custom hazard. Run them as terrain, not initiative rows.',
  },
  {
    id: 'encounter-assize-bailiffs',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'The Assize Retinue',
    kind: 'social',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Noble',
        count: 1,
        ruleset: '2014-srd',
        role: 'Stand-in for Sabine Vale, whose authority is paper rather than steel.',
      },
      {
        name: 'Guard',
        count: 4,
        ruleset: '2014-srd',
        role: 'Bailiffs in grey coats who escort the clerk and carry the writ.',
      },
    ],
    trigger:
      'The Assize arrives in the village and the party, or the Wardens, meet it at the boardwalk gate.',
    intendedUse:
      'Session 3 or 4 social flashpoint. The party decides which side of the paper they stand on.',
    sessionIds: [s(3), s(4)],
    locationIds: ['location-mourningfen-village', 'location-tidewake-archive'],
    factionIds: ['faction-greywater-assize', 'faction-lantern-wardens'],
    tactics:
      'The bailiffs will not draw first. If the Wardens do, they retreat to the ferry and send for a proper garrison.',
    rulesetNotes:
      'Social display fixture. Use the Noble as a bargaining stat line, not a combat threat.',
  },
  {
    id: 'encounter-grandam-kitchen',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Tea With the Grandam',
    kind: 'combat-hazard',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Ghost',
        count: 1,
        ruleset: '2014-srd',
        role: 'Ottoline Verrow, who is not hostile unless addressed wrongly or denied a kind word.',
      },
      {
        name: 'Scalding kettle (hazard)',
        count: 1,
        ruleset: 'custom',
        role: 'A black kettle that never boils until the grandam is angry, then spits 2d6 fire at the nearest character.',
        nonCreature: true,
      },
    ],
    trigger:
      'The party enters the kitchen and speaks to the woman at the table, or refuses what she offers.',
    intendedUse:
      'Session 2 roleplay-first scene. A guest who takes tea and says her name correctly learns who signed the bargain.',
    sessionIds: [s(2)],
    locationIds: ['location-verrow-kitchen', 'location-verrow-hall'],
    factionIds: ['faction-reedbound'],
    tactics:
      'If angered she possesses nothing; she simply stands, turns, and the kitchen empties of warmth. Give the party a chance to apologise before rolling.',
    rulesetNotes:
      'The Ghost is a stand-in. Treat Horrifying Visage as the grandam turning around. The kettle is a custom hazard.',
  },
  {
    id: 'encounter-pear-wife',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'The Pear-Wife’s Bargain',
    kind: 'social',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Green Hag',
        count: 1,
        ruleset: '2014-srd',
        role: 'Sits on the orchard wall and trades salt pears for small memories.',
      },
      {
        name: 'Swarm of Ravens',
        count: 2,
        ruleset: '2014-srd',
        role: 'Her watchers. They strike only if a bargain is broken.',
      },
    ],
    trigger:
      'The party enters the orchard at dusk or eats a pear without paying.',
    intendedUse:
      'Optional Session 2 detour. A morally grey trade: she offers something true in return for something small, and always takes slightly more.',
    sessionIds: [s(2)],
    locationIds: ['location-salt-pear-orchard'],
    factionIds: ['faction-mere-below'],
    tactics:
      'She bargains first, retreats into the trees when pressed, and returns with a better offer the next dusk.',
    rulesetNotes:
      'Green Hag is the SRD stand-in. She is no ally of the Eighth Voice; do not link her to the well fight.',
  },
];
