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
  {
    id: 'encounter-quartz-spur-bridge',
    campaignId: C,
    title: 'The Quartz Spur Bridge',
    kind: 'combat-exploration',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Singing quartz spurs (hazard)',
        count: 1,
        ruleset: 'custom',
        nonCreature: true,
        role: 'Each spur hums a note; stepping on the wrong pitch cracks the span one round early.',
      },
      {
        name: 'Earth Elemental',
        count: 1,
        ruleset: '2014-srd',
        role: 'Drawn to the rescuers’ chorus; rises through the bridge footing.',
      },
      {
        name: 'Cloaker',
        count: 1,
        ruleset: '2014-srd',
        role: 'Hangs among the dark spurs and snatches the last rescuer in line.',
      },
    ],
    trigger:
      'The party crosses the crystalline span to reach the farthest trapped crew, guided by Yarrow’s humming.',
    intendedUse:
      'Session 1 optional beat between the fault and the observatory. Outcome: Yarrow’s pitch-reading let the party cross with one rescuer injured and the earth elemental lured away with a thrown lamp.',
    sessionIds: [S1],
    locationIds: ['location-singing-fault', 'location-kharad-mine'],
    factionIds: ['faction-kharad-delvers-union', 'faction-hold-ghostlamp'],
    tactics:
      'The earth elemental targets whoever sings loudest. A successful note-match check lets a character quiet one spur for a round.',
    rulesetNotes: NOTE,
  },
  {
    id: 'encounter-banquet-of-seven-knives',
    campaignId: C,
    title: 'The Banquet of Seven Knives',
    kind: 'social',
    difficulty: 'high',
    composition: [
      {
        name: 'Noble',
        count: 5,
        ruleset: '2014-srd',
        role: 'Delegates working the room with toasts that double as threats and offers.',
      },
      {
        name: 'Spy',
        count: 2,
        ruleset: '2014-srd',
        role: 'Servants who carry sealed notes between delegations.',
      },
      {
        name: 'Assassin',
        count: 1,
        ruleset: '2014-srd',
        role: 'A hired cup-bearer whose employer is never named.',
      },
    ],
    trigger:
      'The night before the Concord vote, Bellowmere hosts a banquet for the seven delegations in the Hall of the Broken Gate.',
    intendedUse:
      'Session 2 interlude. Outcome: the assassin’s poisoned cup was swapped by Kjeld’s cooks; the party declined to name a suspect and kept the vote intact.',
    sessionIds: [S2],
    locationIds: ['location-broken-gate-hall'],
    factionIds: [
      'faction-hold-bellowmere',
      'faction-hold-highvein',
      'faction-duskforge-hold',
      'faction-seven-hold-concord',
    ],
    tactics:
      'The assassin strikes only if the table’s mood sours; a rapt, flattered room never gives her an opening. Treat accepted offers as finale complications.',
    rulesetNotes: NOTE,
  },
  {
    id: 'encounter-thrumhall-switchyard',
    campaignId: C,
    title: 'The Thrumhall Switchyard',
    kind: 'combat-hazard',
    difficulty: 'high',
    composition: [
      {
        name: 'Rotating switch plates (hazard)',
        count: 3,
        ruleset: 'custom',
        nonCreature: true,
        role: 'Turntables that rotate whole platforms on a shouted timetable.',
      },
      {
        name: 'Animated Armor',
        count: 4,
        ruleset: '2014-srd',
        role: 'Thrumhall ward-suits bound to the yard’s timetable, hostile until a train number is given.',
      },
    ],
    trigger:
      'The gate opens onto the switchyard, and the line’s wardens wake in the middle of a re-routing.',
    intendedUse:
      'Session 2 mid-chase. Outcome: Sunniva shouted the correct timetable from the gantry and the wardens stood down.',
    sessionIds: [S2],
    locationIds: [
      'location-thrumhall-switchyard',
      'location-transit-line',
    ],
    factionIds: ['faction-hold-thrumhall', 'faction-ardent-deep-company'],
    tactics:
      'The ward-suits are a puzzle first: a character who names a valid train number from the Thrumhall timetable ends their attacks for a round.',
    rulesetNotes: NOTE,
  },
  {
    id: 'encounter-ketta-pursuit',
    campaignId: C,
    title: 'Knife-Squads at the Meridian Siding',
    kind: 'combat',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Duergar',
        count: 4,
        ruleset: '2014-srd',
        role: 'Company enforcers who want the deserter before the party reaches the gate.',
      },
      {
        name: 'Cloaker',
        count: 1,
        ruleset: '2014-srd',
        role: 'Tethered to the squad’s sergeant and used to flush Ketta from cover.',
      },
    ],
    trigger:
      'Ketta Rawl is spotted leaving the platform with the party, and the Company’s squads close the siding.',
    intendedUse:
      'Session 2 closing beat. Outcome: the party covered Ketta’s escape; the sergeant was left on the siding with the cloaker unconscious.',
    sessionIds: [S2],
    locationIds: ['location-meridian-station'],
    factionIds: ['faction-ardent-deep-company'],
    tactics:
      'Enforcers go for Ketta first, not the strongest hero. The cloaker retreats at half health.',
    rulesetNotes: NOTE,
  },
  {
    id: 'encounter-deep-sun-flare',
    campaignId: C,
    title: 'The Deep Sun Flare',
    kind: 'combat-hazard',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Casing flare (hazard)',
        count: 1,
        ruleset: 'custom',
        nonCreature: true,
        role: 'The newly kindled casing vents radiant heat in sweeping arcs.',
      },
      {
        name: 'Fire Elemental',
        count: 2,
        ruleset: '2014-srd',
        role: 'Sparks the sun throws off in the first minute of its kindling.',
      },
      {
        name: 'Salamander',
        count: 2,
        ruleset: '2014-srd',
        role: 'Smaller fire-spirits that coil around the rings and guard the casing seams.',
      },
    ],
    trigger:
      'The vessel is kindled; for one minute the casing’s seams spit sparks that take shapes of their own.',
    intendedUse:
      'Session 3 coda before the epilogues. Outcome: the Astronomer vented the flare through the rings and the sparks wandered off into the deep sun’s glow.',
    sessionIds: [S3],
    locationIds: ['location-engine-heart'],
    factionIds: ['faction-astronomers-watch', 'faction-kindled-congregation'],
    tactics:
      'The elementals are drawn to the brightest light source; extinguishing lanterns draws them off the party. The Astronomer can vent the flare once per round at no cost.',
    rulesetNotes: NOTE,
  },
  {
    id: 'encounter-eighth-shaft-descent',
    campaignId: C,
    title: 'Descent into the Eighth Shaft',
    kind: 'combat-exploration',
    difficulty: 'high',
    composition: [
      {
        name: 'Pressure drift (hazard)',
        count: 1,
        ruleset: 'custom',
        nonCreature: true,
        role: 'Every hundred feet inverts the shaft’s gravity; the first inversion drops any unsecured character thirty feet.',
      },
      {
        name: 'Earth Elemental',
        count: 2,
        ruleset: '2014-srd',
        role: 'Drawn by the engine’s hum; surge in from the side walls.',
      },
      {
        name: 'Chuul',
        count: 2,
        ruleset: '2014-srd',
        role: 'Lurk in a flooded landing where the shaft bottoms out.',
      },
    ],
    trigger:
      'Unused sequel encounter: the party opens the sealed shaft beneath the engine.',
    intendedUse:
      'Reserved for a sequel; not run. Outcome: none yet. Use only if the Eighth Light quest reactivates.',
    sessionIds: [],
    locationIds: ['location-eighth-shaft', 'location-engine-heart'],
    factionIds: ['faction-astronomers-watch', 'faction-hold-marrowstone'],
    tactics:
      'The elementals attack in the first inversion; chuul wait at the landing and drag characters under.',
    rulesetNotes: NOTE,
  },
];
