import type { CampaignEncounter } from '../ashes-of-veyra/types';
import { KHARAD_CAMPAIGN_ID as C } from './campaign';

const S1 = `${C}-session-1`;
const S2 = `${C}-session-2`;
const S3 = `${C}-session-3`;

const NOTE =
  'Difficulty is a fixture label for a party of four level 9-10 characters; creature rows use the closest SRD stat blocks (the Astronomer is a Stone Golem stand-in); hazards and lair actions have no stat block.';

export const kharadEncounters: CampaignEncounter[] = [
  {
    id: 'encounter-resonant-fault-collapse',
    campaignId: C,
    title: 'Resonant Fault Collapse',
    kind: 'combat-hazard',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Resonant Fault (hazard)',
        count: 1,
        ruleset: 'custom',
        nonCreature: true,
        role: 'Echoes replay the party’s actions one round early and crack the ceiling.',
      },
      {
        name: 'Darkmantle',
        count: 4,
        ruleset: '2014-srd',
        role: 'Drop from the fault ceiling onto rescuers.',
      },
    ],
    trigger:
      'The party descends the singing fault to reach the trapped survey crews.',
    intendedUse:
      'Session 1 opener; a skill challenge with light combat. Resolved with every miner rescued.',
    sessionIds: [S1],
    locationIds: ['location-singing-fault', 'location-kharad-mine'],
    factionIds: ['faction-kharad-delvers-union'],
    tactics:
      'Darkmantles target whoever carries a rescued miner. The fault collapses in sections at initiative 20.',
    rulesetNotes: NOTE,
  },
  {
    id: 'encounter-survey-crew-defense',
    campaignId: C,
    title: 'Defend the Survey Crew',
    kind: 'combat',
    difficulty: 'high',
    composition: [
      {
        name: 'Xorn',
        count: 2,
        ruleset: '2014-srd',
        role: 'Phase through walls to strike the exposed crew.',
      },
      {
        name: 'Gravitic Pulse (lair action)',
        count: 1,
        ruleset: 'custom',
        nonCreature: true,
        role: 'At initiative 20 every creature is pulled toward a different wall.',
      },
    ],
    trigger: 'The first star wakes while the crew is still inside the observatory.',
    intendedUse:
      'Session 1 primary combat. Outcome: the xorn retreated into the rock when the pulses ended and the crew survived.',
    sessionIds: [S1],
    locationIds: ['location-inverted-observatory'],
    factionIds: ['faction-chalkline-collegium'],
    tactics:
      'Xorn pop from walls, bite, and vanish. Pulses drag squishy crew toward hazards.',
    rulesetNotes: NOTE,
  },
  {
    id: 'encounter-council-at-broken-gate',
    campaignId: C,
    title: 'Council at the Broken Gate',
    kind: 'social',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Noble',
        count: 7,
        ruleset: '2014-srd',
        role: 'Each offers aid with a visible price; two ask for sabotage in private.',
      },
    ],
    trigger: 'The party petitions the Concord to open the sealed transit gate.',
    intendedUse:
      'Session 2 opener. Outcome: a majority voted to open the gate; sabotage offers were declined.',
    sessionIds: [S2],
    locationIds: ['location-broken-gate-hall'],
    factionIds: ['faction-seven-hold-concord', 'faction-duskforge-hold'],
    tactics:
      'Delegates trade votes for promises. Track each accepted resource as a finale complication.',
    rulesetNotes: NOTE,
  },
  {
    id: 'encounter-transit-line-chase',
    campaignId: C,
    title: 'The Unstable Transit Line',
    kind: 'combat-hazard',
    difficulty: 'high',
    composition: [
      {
        name: 'Unstable rail segments (hazard)',
        count: 3,
        ruleset: 'custom',
        nonCreature: true,
        role: 'Each stage rearranges the route and gravity.',
      },
      {
        name: 'Duergar',
        count: 4,
        ruleset: '2014-srd',
        role: 'Ardent Company riders harass from behind.',
      },
    ],
    trigger: 'The gate opens and the rival expedition gives chase.',
    intendedUse:
      'Session 2 chase. Outcome: the party reached Meridian Station with a narrow lead.',
    sessionIds: [S2],
    locationIds: ['location-transit-line'],
    factionIds: ['faction-ardent-deep-company'],
    tactics:
      'Riders focus on the slowest cart. Each stage ends when a party check locks the next switch.',
    rulesetNotes: NOTE,
  },
  {
    id: 'encounter-ordrun-station-ambush',
    campaignId: C,
    title: 'Ordrun’s Ambush at Meridian Station',
    kind: 'combat',
    difficulty: 'high',
    composition: [
      {
        name: 'Veteran',
        count: 1,
        ruleset: '2014-srd',
        role: 'Commands the trap and withdraws when outmatched.',
      },
      {
        name: 'Duergar',
        count: 3,
        ruleset: '2014-srd',
        role: 'Hold the platform and enlarge for the push.',
      },
      {
        name: 'Animated Armor',
        count: 1,
        ruleset: '2014-srd',
        role: 'A tamed war-construct that hunts the gate keyholder.',
      },
    ],
    trigger: 'The party steps onto Meridian Station after the chase.',
    intendedUse:
      'Session 2 climax. Outcome: Ordrun broke off, leaving a courier and her sealed orders behind.',
    sessionIds: [S2],
    locationIds: ['location-transit-line'],
    factionIds: ['faction-ardent-deep-company'],
    tactics:
      'The predator targets the custodian. Ordrun withdraws at half strength rather than lose the race.',
    rulesetNotes: NOTE,
  },
  {
    id: 'encounter-zero-gravity-vault',
    campaignId: C,
    title: 'The Zero-Gravity Vault',
    kind: 'combat-exploration',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Gargoyle',
        count: 4,
        ruleset: '2014-srd',
        role: 'Hold statues that animate and attack from floating fragments.',
      },
      {
        name: 'Drifting history shards (hazard)',
        count: 1,
        ruleset: 'custom',
        nonCreature: true,
        role: 'Jump points whose landing spots replay hold histories.',
      },
    ],
    trigger: 'The party crosses the vault to reach the engine heart.',
    intendedUse:
      'Session 3 opener. Outcome: the party crossed intact and read the holds’ history in passing.',
    sessionIds: [S3],
    locationIds: ['location-zero-gravity-vault'],
    factionIds: ['faction-astronomers-watch'],
    tactics:
      'Gargoyles use flyby strikes from cover. A missed jump sends a character drifting to the next shard.',
    rulesetNotes: NOTE,
  },
  {
    id: 'encounter-astronomer-awakens',
    campaignId: C,
    title: 'The Astronomer Awakens',
    kind: 'combat-hazard',
    difficulty: 'high',
    composition: [
      {
        name: 'Stone Golem',
        count: 1,
        ruleset: '2014-srd',
        role: 'Mythic guardian; shifts gravity, terrain, and its goal per ring.',
      },
      {
        name: 'Stone Golem',
        count: 2,
        ruleset: '2014-srd',
        role: 'Anchor the rings and shove creatures into the void.',
      },
      {
        name: 'Shadow',
        count: 6,
        ruleset: '2014-srd',
        role: 'Blink between rings and drain light.',
      },
    ],
    trigger: 'The party enters the engine heart and the rings begin to align.',
    intendedUse:
      'Session 3 finale. Outcome: the Astronomer surrendered after the party stated a shared purpose.',
    sessionIds: [S3],
    locationIds: ['location-engine-heart'],
    factionIds: ['faction-astronomers-watch', 'faction-ardent-deep-company'],
    tactics:
      'Each aligned ring changes gravity and the guardian’s goal. It can surrender at any time the party names a shared purpose.',
    rulesetNotes: NOTE,
  },
  {
    id: 'encounter-fate-of-the-vessel',
    campaignId: C,
    title: 'The Fate of the Vessel',
    kind: 'social',
    difficulty: 'high',
    composition: [
      {
        name: 'Noble',
        count: 6,
        ruleset: '2014-srd',
        role: 'Each argues for launch, burial, or a weapon.',
      },
    ],
    trigger: 'The Astronomer stands down and the vessel’s fate is open.',
    intendedUse:
      'Session 3 decision scene. Outcome: the party kindled the vessel as a deep sun, keeping most promises.',
    sessionIds: [S3],
    locationIds: ['location-engine-heart', 'location-kharad-commons'],
    factionIds: [
      'faction-seven-hold-concord',
      'faction-duskforge-hold',
      'faction-ardent-deep-company',
    ],
    tactics:
      'Launch, burial, and ignition each honor one promise and break another; let the players feel the cost.',
    rulesetNotes: NOTE,
  },
];
