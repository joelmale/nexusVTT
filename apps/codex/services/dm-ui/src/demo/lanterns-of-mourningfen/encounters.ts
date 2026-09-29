import type { CampaignEncounter } from '../ashes-of-veyra/types';
import { MOURNINGFEN_CAMPAIGN_ID, mourningfenSessionId as s } from './campaign';

const DIFFICULTY_NOTE =
  'Display difficulty is a fixture. Creatures use compatible 2014 SRD definitions in this 2014/2024-compatible campaign; marsh spirits are custom.';

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
        name: 'Ysolde Verrow (Ghost)',
        count: 1,
        ruleset: '2014-srd',
        role: 'Leads the procession and decides whether to speak.',
      },
      {
        name: 'Reedbound Mourner',
        count: 6,
        ruleset: 'custom',
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
      'Social difficulty is a display fixture, not a rules calculation.',
  },
  {
    id: 'encounter-shifting-rooms',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'The Shifting Rooms',
    kind: 'combat-hazard',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Poltergeist (adjusted)',
        count: 1,
        ruleset: 'custom',
        role: 'Slams doors and drops the floor plan into the wrong loop. Stat line not yet adjusted for level 4.',
      },
      {
        name: 'Reflection Wisp',
        count: 3,
        ruleset: 'custom',
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
      'Campaign-specific creatures and hazard; difficulty is a display fixture.',
  },
  {
    id: 'encounter-well-whisperer',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'What Answers From the Well',
    kind: 'combat',
    difficulty: 'high',
    composition: [
      {
        name: 'Eighth Voice (Whisperer)',
        count: 1,
        ruleset: 'custom',
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
      'Custom creature; treat as a high-difficulty display fixture until stats are written.',
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
        name: 'Dunmore Fenn (Veteran)',
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
];
