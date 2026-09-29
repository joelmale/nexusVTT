import type { CampaignEncounter } from '../ashes-of-veyra/types';
import { CROWN_CAMPAIGN_ID, crownSessionId } from './campaign';

export const crownEncounters: CampaignEncounter[] = [
  {
    id: 'encounter-cinder-wights-dais',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Cinder Wights at the Dais',
    kind: 'combat-hazard',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Cinder Wight',
        count: 2,
        ruleset: 'custom',
        role: 'Ignite the banners and drive guests away from the dais.',
      },
      {
        name: 'Smoke Mephit',
        count: 1,
        ruleset: '2014-srd',
        role: 'Blinds defenders with smoke while the wights advance.',
      },
    ],
    trigger:
      'The Crown speaks its accusation and the ceremonial braziers flare white.',
    intendedUse:
      'Session 1 primary encounter; the burning tapestries are a visible three-round clock and rescuing guests matters more than killing every attacker.',
    sessionIds: [crownSessionId(1)],
    locationIds: ['location-hall-of-nine-banners'],
    factionIds: ['faction-unquenched'],
    tactics:
      'Wights spread fire between banners to split the room. They retreat into the smoke once two banners are down; the mephit hunts anyone carrying the crown.',
    rulesetNotes:
      'Cinder Wight is a custom level-1 stat block (roughly CR 1/2): fire-immune, vulnerable to water. Smoke Mephit uses the compatible 2014 SRD entry.',
  },
  {
    id: 'encounter-heirs-audience',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Audience with the Heirs',
    kind: 'social',
    difficulty: 'low',
    composition: [
      {
        name: 'Noble (Corvin, Ysolde or Tamsin)',
        count: 3,
        ruleset: '2014-srd',
        role: 'Each heir makes a different case for the crown and offers the party a private favor.',
      },
    ],
    trigger:
      'Each character is drawn aside before the ceremony by a different heir.',
    intendedUse:
      'Session 1 opening scene; seeds the three heirs as sympathetic and gives each one contradictory gossip.',
    sessionIds: [crownSessionId(1)],
    locationIds: ['location-hall-of-nine-banners'],
    factionIds: ['faction-house-vell'],
    tactics:
      'No combat. Corvin pushes loyalty, Ysolde pushes advantage, Tamsin pushes honesty; none of them lies about the thing the party asks first.',
    rulesetNotes:
      'Display difficulty is a fixture. Social scene; stat blocks only for surprise escalation.',
  },
  {
    id: 'encounter-guttered-candle-brawl',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Brawl at the Guttered Candle',
    kind: 'combat',
    difficulty: 'low',
    composition: [
      {
        name: 'Thug',
        count: 2,
        ruleset: '2014-srd',
        role: 'Guild muscle who block the cellar door.',
      },
      {
        name: 'Bandit',
        count: 2,
        ruleset: '2014-srd',
        role: 'Grab lamps and throw oil to cover a retreat.',
      },
    ],
    trigger:
      'The party asks about the flame signal in the wrong room or pushes Nell Soot too hard.',
    intendedUse:
      'Session 2 optional combat; can be defused with a favor or a good bluff.',
    sessionIds: [crownSessionId(2)],
    locationIds: ['location-guttered-candle'],
    factionIds: ['faction-soot-hands'],
    tactics:
      'Thugs hold the door while the bandits smash lamps; the crew scatters when Nell shouts the guild call.',
    rulesetNotes:
      'Uses compatible 2014 SRD creatures. Not yet balanced for the final party composition.',
  },
  {
    id: 'encounter-vault-guardians',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Guardians of the Crown Vault',
    kind: 'combat-exploration',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Animated Armor',
        count: 2,
        ruleset: '2014-srd',
        role: 'Warden-forged sentinels that attack anyone not carrying the crown.',
      },
      {
        name: 'Magma Mephit',
        count: 1,
        ruleset: '2014-srd',
        role: 'A bound elemental that flares when the crown speaks aloud.',
      },
    ],
    trigger:
      'The party enters the vault without the crown, or the crown speaks a name from the burn list.',
    intendedUse:
      'Session 4 dungeon beat; the crown can disarm the guardians if it is asked the right question.',
    sessionIds: [crownSessionId(4)],
    locationIds: ['location-crown-vault'],
    factionIds: ['faction-ember-wardens'],
    tactics:
      'Armor blocks corridors while the mephit ignites braziers; the fight ends when the party answers the vault riddle.',
    rulesetNotes:
      'Uses compatible 2014 SRD creatures. Prepared for party level 3; retune if the party is below that.',
  },
  {
    id: 'encounter-catacomb-ashbound',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'The Ashbound in the Catacombs',
    kind: 'combat-exploration',
    difficulty: 'high',
    composition: [
      {
        name: 'Cult Fanatic',
        count: 1,
        ruleset: '2014-srd',
        role: 'Leads the Unquenched rite and hurls cinders.',
      },
      {
        name: 'Cultist',
        count: 4,
        ruleset: '2014-srd',
        role: 'Feed the rite pit and swarm intruders.',
      },
      {
        name: 'Magma Mephit',
        count: 1,
        ruleset: '2014-srd',
        role: 'Raises the temperature in the rite chamber each round.',
      },
    ],
    trigger:
      'The party follows the paymaster trail beneath the Ember Cloister.',
    intendedUse:
      'Session 5 finale; Mother Cinder appears at the end of the encounter and escapes unless stopped.',
    sessionIds: [crownSessionId(5)],
    locationIds: ['location-ashen-catacombs'],
    factionIds: ['faction-unquenched'],
    tactics:
      'Cultists guard the rite pit; the fanatic retreats to the far ledge. Extinguishing the pit ends the rite and weakens the mephit.',
    rulesetNotes:
      'Uses compatible 2014 SRD creatures. Encounter is a draft; difficulty needs a playtest pass.',
  },
];
