import type { CampaignEncounter } from './types';

export const encounters: CampaignEncounter[] = [
  {
    id: 'encounter-dockside-ambush',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Dockside Ambush',
    kind: 'combat',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Bandit Captain',
        count: 1,
        ruleset: '2014-srd',
        role: 'Kestrel Ruhn: coordinates the seizure and calls a retreat.',
      },
      {
        name: 'Bandit',
        count: 4,
        ruleset: '2014-srd',
        role: 'Block escape routes and target the ledger carrier.',
      },
      {
        name: 'Mastiff',
        count: 1,
        ruleset: '2014-srd',
        role: 'Tracks the ledger satchel through the crowd.',
      },
    ],
    trigger:
      'The party reaches the eastern pier or attracts attention while carrying the ledger.',
    intendedUse:
      'Session 12 primary encounter; attackers want the ledger and attempt to flee with it.',
    sessionIds: ['session-12'],
    locationIds: ['location-south-pier', 'location-north-docks'],
    factionIds: ['faction-crimson-wake'],
    tactics:
      'The captain creates a gap for one bandit to grab the satchel. They disengage when the captain falls; they fight to the death only if cornered. If Kestrel is captured alive he names Selka as the buyer and then lies about it.',
    rulesetNotes:
      'Display difficulty is a fixture. Creatures use compatible 2014 SRD definitions in this 2024 campaign.',
  },
  {
    id: 'encounter-sahuagin-patrol',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Sahuagin Patrol',
    kind: 'combat-exploration',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Sahuagin',
        count: 4,
        ruleset: '2014-srd',
        role: 'Circle the party from cover and retreat toward deep water.',
      },
      {
        name: 'Sahuagin',
        count: 1,
        ruleset: '2014-srd',
        role: 'Signals the patrol and avoids the route beneath Customs House.',
      },
    ],
    trigger: 'The party searches the outer docks after midnight.',
    intendedUse:
      'Optional pressure encounter that foreshadows the submerged route.',
    sessionIds: ['session-12', 'session-13'],
    locationIds: ['location-south-pier', 'location-north-docks'],
    factionIds: ['faction-choir-below', 'faction-sunken-reach'],
    tactics:
      'The scout watches from the waterline while the patrol tests the party, breaking away if the signal horn is silenced.',
    rulesetNotes:
      'Sahuagin use compatible 2014 SRD definitions; scout role is campaign-specific.',
  },
  {
    id: 'encounter-city-watch-checkpoint',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'City Watch Checkpoint',
    kind: 'social',
    difficulty: 'low',
    composition: [
      {
        name: 'Veteran',
        count: 1,
        ruleset: '2014-srd',
        role: 'Sergeant Corr: reads the party and decides whether to escalate.',
      },
      {
        name: 'Guard',
        count: 4,
        ruleset: '2014-srd',
        role: 'Secure the lane and inspect cargo.',
      },
      {
        name: 'Commoner',
        count: 1,
        ruleset: '2014-srd',
        role: 'Recognizes inconsistencies in the false manifest.',
      },
    ],
    trigger: 'The party transports contraband across the inner wards.',
    intendedUse:
      'Skill challenge or negotiation; can expose Kael connection to the Watch.',
    sessionIds: ['session-10', 'session-12'],
    locationIds: ['location-old-customs-house', 'location-fishmongers-row'],
    factionIds: ['faction-harbor-watch'],
    tactics:
      'The sergeant seeks a plausible reason to confiscate the cargo without making a public scene. If Kael speaks first, Corr hesitates and offers one quiet way through.',
    rulesetNotes:
      'Social difficulty is a display fixture, not a rules calculation.',
  },
  {
    id: 'encounter-drowned-cellar',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'The Drowned Cellar',
    kind: 'combat-hazard',
    difficulty: 'high',
    composition: [
      {
        name: 'Zombie',
        count: 2,
        ruleset: '2014-srd',
        role: 'Rise from brackish water to pin intruders in the cellar.',
      },
      {
        name: 'Grasping Tide',
        count: 1,
        ruleset: 'custom',
        nonCreature: true,
        role: 'Environmental hazard that pulls creatures toward a submerged grate.',
      },
    ],
    trigger: 'The party opens the cellar below the Salty Mast.',
    intendedUse:
      'Discovery encounter that connects Mara shelter to the Choir Below.',
    sessionIds: ['session-9', 'session-12'],
    locationIds: ['location-salty-mast'],
    factionIds: ['faction-choir-below'],
    tactics:
      'The drowned dead grapple whoever approaches the grate while the tide hazard rises each round.',
    rulesetNotes:
      'Creatures use compatible 2014 SRD definitions (Veteran, Commoner, Zombie). The tide is a hazard with no stat block. Difficulty is a display fixture.',
  },
  {
    id: 'encounter-wreck-scavengers',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Scavengers of the Northstar Wreck',
    kind: 'combat-exploration',
    difficulty: 'low',
    composition: [
      {
        name: 'Giant Crab',
        count: 3,
        ruleset: '2014-srd',
        role: 'Nest in the cargo hold and pinch anyone reaching for the crate.',
      },
      {
        name: 'Reef Shark',
        count: 1,
        ruleset: '2014-srd',
        role: 'Circles the flooded gangway and punishes anyone who falls in.',
      },
      {
        name: 'Rising Surf',
        count: 1,
        ruleset: 'custom',
        nonCreature: true,
        role: 'Each round a wave knocks unsecured creatures prone on the slick deck.',
      },
    ],
    trigger: 'Survivors climb the wreck to recover the ember-marked crate.',
    intendedUse:
      'Session 1 opener: teach the table to improvise with terrain while the crate hums faintly in the hold.',
    sessionIds: ['session-1'],
    locationIds: ['location-black-shoals'],
    factionIds: [],
    tactics:
      'Crabs defend the nest rather than chase. The shark only commits when a creature is bleeding in the water.',
    rulesetNotes:
      'Played at level 3. Rising Surf is a hazard with no stat block: Strength save or fall prone.',
  },
  {
    id: 'encounter-shoal-tracks',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Tracks on the Black Shoals',
    kind: 'combat-exploration',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Sahuagin',
        count: 3,
        ruleset: '2014-srd',
        role: 'Probe the camp from the waterline and withdraw when hurt.',
      },
      {
        name: 'Priest',
        count: 1,
        ruleset: '2014-srd',
        role: 'Stands in for the sahuagin priestess: directs the raid and halts it if the party shows the drowned seal.',
      },
    ],
    trigger:
      'The party follows webbed prints from the wreck to a tidal cave at nightfall.',
    intendedUse:
      'Session 3 reveal that the sahuagin are guarding a route, not hunting survivors; reward careful tracking.',
    sessionIds: ['session-3'],
    locationIds: ['location-black-shoals'],
    factionIds: ['faction-sunken-reach'],
    tactics:
      'The priestess calls a halt after one round if the party has not killed anyone, and speaks broken Common about "the door below".',
    rulesetNotes:
      'Sahuagin use compatible 2014 SRD definitions; the Priest stat block represents the sahuagin priestess. Allow the encounter to end in parley.',
  },
  {
    id: 'encounter-spire-wards',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Guardians of the Fractured Spire',
    kind: 'combat-hazard',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Flying Sword',
        count: 3,
        ruleset: '2014-srd',
        role: 'Animated observatory instruments that guard the lens mount.',
      },
      {
        name: 'Ward Lash',
        count: 1,
        ruleset: 'custom',
        nonCreature: true,
        role: 'Pre-Veyran ward that arcs lightning to the tallest metal object each round.',
      },
    ],
    trigger: 'The party crosses the cracked lens gallery at the spire apex.',
    intendedUse:
      'Session 4 centerpiece: Lira studies the wards while the others hold the line.',
    sessionIds: ['session-4'],
    locationIds: ['location-fractured-spire'],
    factionIds: ['faction-lantern-guild'],
    tactics:
      'The swords strike the wizard first because the ward keys on arcane focus. Disabling the lash with a DC 14 Arcana check ends it.',
    rulesetNotes:
      'Ward Lash is a hazard with no stat block: 2d8 lightning, Dexterity save for half.',
  },
  {
    id: 'encounter-crimson-wake-parley',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Parley with the Crimson Wake',
    kind: 'social',
    difficulty: 'low',
    composition: [
      {
        name: 'Spy',
        count: 1,
        ruleset: '2014-srd',
        role: 'Selka Marr: conducts the negotiation and watches for lies.',
      },
      {
        name: 'Thug',
        count: 2,
        ruleset: '2014-srd',
        role: 'Quiet leverage at the table; never speak.',
      },
    ],
    trigger:
      "Mira accepts a private meeting to hear the terms of her family debt: first at a coastal smugglers' landing (session 5), then in the Salty Mast back room (session 9).",
    intendedUse:
      'Sessions 5 and 9 negotiation: Selka offers information for a favor and shows the party the cost of refusing.',
    sessionIds: ['session-5', 'session-9'],
    locationIds: [
      'location-salty-mast',
      'location-north-docks',
      'location-veyra-coast',
    ],
    factionIds: ['faction-crimson-wake'],
    tactics:
      'Selka concedes small points to appear reasonable and holds the one fact that matters. The thugs only act if the table turns violent.',
    rulesetNotes:
      'Run as a three-round skill challenge (Insight, Persuasion, Deception). Failing twice triggers the Wake leverage described on the Debt in Blood quest.',
  },
  {
    id: 'encounter-synod-audience',
    campaignId: 'campaign-ashes-of-veyra',
    title: "Audience with Prelate Voss",
    kind: 'social',
    difficulty: 'low',
    composition: [
      {
        name: 'Priest',
        count: 1,
        ruleset: '2014-srd',
        role: 'Oren Voss: gracious host who gently pressures Torin.',
      },
      {
        name: 'Acolyte',
        count: 2,
        ruleset: '2014-srd',
        role: 'Silent attendants; one is Brother Tamsin, who will not meet anyone eye.',
      },
    ],
    trigger:
      'The party answers a sealed invitation delivered to Torin at the Salty Mast.',
    intendedUse:
      'Session 10: establish Voss as sincere and dangerous, and plant Tamsin as a thread for later.',
    sessionIds: ['session-10'],
    locationIds: ['location-synod-relief-house', 'location-old-customs-house'],
    factionIds: ['faction-ashen-synod'],
    tactics:
      'Voss offers the Synod protection in exchange for custody of the key. Every refusal is met with warmth and a new, smaller request.',
    rulesetNotes:
      'Social difficulty is a display fixture. No dice are rolled unless the party attacks.',
  },
  {
    id: 'encounter-warehouse-fire',
    campaignId: 'campaign-ashes-of-veyra',
    title: "Fire on Fishmongers' Row",
    kind: 'combat-hazard',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Thug',
        count: 3,
        ruleset: '2014-srd',
        role: 'Hired arsonists protecting the stall that holds the ledger.',
      },
      {
        name: 'Spreading Fire',
        count: 1,
        ruleset: 'custom',
        nonCreature: true,
        role: 'Adds a burning zone each round; spreads toward the chandlery.',
      },
    ],
    trigger:
      'Pell warns the party that someone is soaking the canvas awnings with lamp oil.',
    intendedUse:
      'Session 11 rescue clock: success is people and evidence saved, not enemies defeated.',
    sessionIds: ['session-11'],
    locationIds: ['location-fishmongers-row'],
    factionIds: ['faction-ashen-synod', 'faction-harbor-watch'],
    tactics:
      'The thugs flee once the ledger stall is burning. If caught, one admits the pay came with a Watch tally stamp.',
    rulesetNotes:
      'Spreading Fire is a hazard with no stat block: 1d10 fire in the zone, bucket chains reduce spread by one square per two helpers.',
  },
  {
    id: 'encounter-flooded-undercroft',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'The Flooded Undercroft',
    kind: 'combat-exploration',
    difficulty: 'high',
    composition: [
      {
        name: 'Zombie',
        count: 4,
        ruleset: '2014-srd',
        role: 'Choir thralls that hold the stair landings.',
      },
      {
        name: 'Specter',
        count: 1,
        ruleset: '2014-srd',
        role: 'The drowned voice; speaks to Torin and tests the party resolve.',
      },
      {
        name: 'Rising Flood',
        count: 1,
        ruleset: 'custom',
        nonCreature: true,
        role: 'Water level rises one foot each round until the arch is sealed.',
      },
    ],
    trigger: 'The party descends the sealed stair at low tide in session 13.',
    intendedUse:
      'Session 13 centerpiece: a timed fight where the choice is the key or the trapped Synod agents.',
    sessionIds: ['session-13'],
    locationIds: ['location-flooded-undercroft', 'location-old-customs-house'],
    factionIds: ['faction-choir-below', 'faction-ashen-synod'],
    tactics:
      'Zombies fight to hold doors. The specter withdraws if Torin speaks the right bell-name. The flood forces a decision about who is saved.',
    rulesetNotes:
      'Rising Flood is a hazard with no stat block: Athletics checks at the third round onward; creatures below the waterline have disadvantage.',
  },
  {
    id: 'encounter-rook-confrontation',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Confronting Warden Rook',
    kind: 'social',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Knight',
        count: 1,
        ruleset: '2014-srd',
        role: 'Elian Rook: calm, armed, and certain he can talk his way out.',
      },
      {
        name: 'Guard',
        count: 4,
        ruleset: '2014-srd',
        role: 'Loyal to the uniform; side with whoever has the law.',
      },
    ],
    trigger:
      'The party presents the forged dismissal order and the ash-ink evidence in the customs record vault.',
    intendedUse:
      'Session 13 or later payoff for Kael thread; can turn to combat if the party overplays.',
    sessionIds: ['session-13'],
    locationIds: ['location-old-customs-house'],
    factionIds: ['faction-harbor-watch'],
    tactics:
      'Rook denies, deflects, then offers Kael his old rank. If Sergeant Corr sides with the party the guards stand down.',
    rulesetNotes:
      'Run as a contested social scene. Combat uses compatible 2014 SRD Knight and Guard definitions.',
  },
];
