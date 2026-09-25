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
        role: 'Coordinates the seizure and calls a retreat.',
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
      'The captain creates a gap for one bandit to grab the satchel. They disengage when the captain falls; they fight to the death only if cornered.',
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
        name: 'Sahuagin Scout',
        count: 1,
        ruleset: 'custom',
        role: 'Signals the patrol and avoids the route beneath Customs House.',
      },
    ],
    trigger: 'The party searches the outer docks after midnight.',
    intendedUse:
      'Optional pressure encounter that foreshadows the submerged route.',
    sessionIds: ['session-12', 'session-13'],
    locationIds: ['location-south-pier', 'location-north-docks'],
    factionIds: ['faction-choir-below'],
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
        name: 'Watch Sergeant',
        count: 1,
        ruleset: 'custom',
        role: 'Reads the party and decides whether to escalate.',
      },
      {
        name: 'Guard',
        count: 4,
        ruleset: '2014-srd',
        role: 'Secure the lane and inspect cargo.',
      },
      {
        name: 'Customs Clerk',
        count: 1,
        ruleset: 'custom',
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
      'The sergeant seeks a plausible reason to confiscate the cargo without making a public scene.',
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
        name: 'Drowned Dead',
        count: 2,
        ruleset: 'custom',
        role: 'Rise from brackish water to pin intruders in the cellar.',
      },
      {
        name: 'Grasping Tide',
        count: 1,
        ruleset: 'custom',
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
      'Campaign-specific creatures and hazard; difficulty is a display fixture.',
  },
];
