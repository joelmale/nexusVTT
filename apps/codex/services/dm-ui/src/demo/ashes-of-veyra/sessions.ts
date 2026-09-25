import type { CampaignSession, SessionPlan } from './types';

const sessionRecords: Omit<
  CampaignSession,
  | 'id'
  | 'campaignId'
  | 'actId'
  | 'number'
  | 'partyLevel'
  | 'tags'
  | 'questIds'
  | 'npcIds'
  | 'factionIds'
  | 'locationIds'
  | 'encounterIds'
  | 'clueIds'
  | 'handoutIds'
>[] = [
  {
    title: 'Wreck on the Black Shoals',
    status: 'complete',
    summary:
      'Survivors escape the Northstar wreck and recover the first ember-marked crate.',
  },
  {
    title: 'The Lantern Road',
    status: 'complete',
    summary: 'The party escorts refugees inland and meets the Lantern Guild.',
  },
  {
    title: 'Salt in the Wound',
    status: 'complete',
    summary: 'Sahuagin tracks reveal organized activity around the shoals.',
  },
  {
    title: 'The Fractured Spire',
    status: 'complete',
    summary:
      'A sealed observatory points toward Glass Harbor and a missing lens.',
  },
  {
    title: 'A Debt in Blood',
    status: 'complete',
    summary: "Mira's family debt becomes leverage for the Crimson Wake.",
  },
  {
    title: 'Bells Beneath the Tide',
    status: 'complete',
    summary: 'The party hears the drowned choir for the first time.',
  },
  {
    title: 'Passage to Veyra',
    status: 'complete',
    summary: 'The party secures transport into the city.',
  },
  {
    title: 'City of Glass and Salt',
    status: 'complete',
    summary: 'Harbor factions and wards are introduced.',
  },
  {
    title: 'The Salty Mast',
    status: 'complete',
    summary: 'Selka Marr offers information in exchange for a favor.',
  },
  {
    title: 'Customs and Contraband',
    status: 'complete',
    summary: 'A false manifest connects the Ashen Synod to missing cargo.',
  },
  {
    title: "Smoke over Fishmongers' Row",
    status: 'complete',
    summary:
      'The party prevents an arson and recovers the burned shipping ledger.',
  },
  {
    title: 'The Glass Harbor',
    status: 'draft',
    summary:
      'Follow Captain Serin warning to the eastern pier as rival crews move to seize the ledger.',
    plannedDate: '2025-04-26',
    durationHours: 4,
  },
  {
    title: 'Under the Customs House',
    status: 'planned',
    summary: 'Explore the flooded tunnel and recover the Ember Key.',
  },
];

export const session12Plan: SessionPlan = {
  revision: 3,
  lastEdited: '2 hours ago',
  estimatedMinutes: 235,
  readiness: [
    {
      id: 'readiness-opening-recap',
      label: 'Opening recap ready',
      complete: true,
    },
    {
      id: 'readiness-scene',
      label: 'Glass Harbor Docks scene linked',
      complete: true,
    },
    {
      id: 'readiness-warning',
      label: "Harbormaster's Warning attached",
      complete: true,
    },
    {
      id: 'readiness-encounter',
      label: 'Dockside Ambush reviewed',
      complete: true,
    },
    {
      id: 'readiness-player-summary',
      label: 'Player-facing summary written',
      complete: false,
    },
    { id: 'readiness-closing', label: 'Closing beat checked', complete: false },
  ],
  dependencies: [
    { objectId: 'scene-glass-harbor-docks', status: 'ready' },
    { objectId: 'encounter-dockside-ambush', status: 'ready' },
    { objectId: 'handout-burned-shipping-ledger', status: 'needs-review' },
  ],
  steps: [
    {
      id: 'step-opening-recap',
      order: 1,
      kind: 'recap',
      track: 'main',
      title: 'Opening recap',
      durationMinutes: 10,
      visibility: 'shared',
      body: "Re-establish the burned ledger, Serin's quiet request, and the pressure each faction is putting on the party.",
    },
    {
      id: 'step-glass-harbor-docks',
      order: 2,
      kind: 'scene',
      track: 'main',
      title: 'Activate scene: Glass Harbor Docks',
      durationMinutes: 5,
      visibility: 'shared',
      objectId: 'scene-glass-harbor-docks',
      body: 'Evening at the eastern pier. Light rain beads on the ropes; the Watch is changing shifts.',
    },
    {
      id: 'step-harbormaster-warning',
      order: 3,
      kind: 'note',
      track: 'main',
      title: "Open note: Harbormaster's Warning",
      durationMinutes: 10,
      visibility: 'shared',
      objectId: 'handout-harbormasters-warning',
      body: 'Captain Serin asks the party to watch the eastern pier without involving the Watch. Typed reference: @Captain Serin is worried Warden Rook will erase the manifest.',
    },
    {
      id: 'step-dockside-ambush',
      order: 4,
      kind: 'encounter',
      track: 'main',
      title: 'Deploy encounter: Dockside Ambush',
      durationMinutes: 30,
      visibility: 'dm-only',
      objectId: 'encounter-dockside-ambush',
      body: 'The attackers want the ledger. One bandit tries to take the satchel while the others create an escape lane; they do not fight to the death unless cornered.',
    },
    {
      id: 'step-burned-ledger',
      order: 5,
      kind: 'handout',
      track: 'main',
      title: 'Share handout: Burned Shipping Ledger',
      durationMinutes: 5,
      visibility: 'shared',
      objectId: 'handout-burned-shipping-ledger',
      body: 'Reveal the Dawn Petrel, pier 6, and the phrase "third bell" after the encounter.',
    },
    {
      id: 'step-fleeing-bandit-choice',
      order: 6,
      kind: 'choice',
      track: 'main',
      title: 'Optional: Follow the fleeing bandit or confront the Watch',
      durationMinutes: 20,
      visibility: 'dm-only',
      body: 'The party can pursue the courier along the chainwalk or hold position as the Watch patrol arrives.',
    },
    {
      id: 'step-bell-closing',
      order: 7,
      kind: 'closing',
      track: 'main',
      title: 'Closing beat: The bell below the harbor',
      durationMinutes: 5,
      visibility: 'shared',
      body: 'At low tide, a bell sounds beneath the harbor. The water in the mooring rings ripples inward.',
    },

    // ── PARALLEL THREADS ──────────────────────────────────────────────────────
    {
      id: 'step-quest-ember-key',
      order: 8,
      kind: 'note',
      track: 'parallel',
      title: 'Quest: Find the Ember Key',
      durationMinutes: 0,
      visibility: 'dm-only',
      body: 'The Ember Key was last seen at customs. Multiple factions now know the party has a lead.',
    },
    {
      id: 'step-quest-mira-debt',
      order: 9,
      kind: 'note',
      track: 'parallel',
      title: "Quest: Mira's Debt to the Crimson Wake",
      durationMinutes: 0,
      visibility: 'dm-only',
      body: 'Resolution may span sessions. Note leverage the Crimson Wake applies if Mira acts openly.',
    },
    {
      id: 'step-handout-writ',
      order: 10,
      kind: 'handout',
      track: 'parallel',
      title: 'Port Authority Entry Writ',
      durationMinutes: 2,
      visibility: 'shared',
      objectId: 'handout-port-authority-writ',
      body: 'Surface when the party inspects the warehouse gate or asks a Watch officer for access.',
    },
    {
      id: 'step-handout-letter',
      order: 11,
      kind: 'handout',
      track: 'parallel',
      title: 'Mysterious Unsigned Letter (pier 6)',
      durationMinutes: 2,
      visibility: 'shared',
      objectId: 'handout-unsigned-letter-pier6',
      body: "Surface when pacing allows — preferably after the ambush to seed the 'third bell' thread.",
    },
    {
      id: 'step-decision-selka',
      order: 12,
      kind: 'recap',
      track: 'parallel',
      title: 'Decision: Trust Selka Marr or report to the Watch?',
      durationMinutes: 0,
      visibility: 'dm-only',
      body: 'Selka will trade ledger insight for the Ember Key. Note the party instinct — no forced answer needed this session.',
    },
    {
      id: 'step-sahuagin-patrol',
      order: 13,
      kind: 'encounter',
      track: 'parallel',
      title: 'Optional: Sahuagin Patrol (eastern mooring)',
      durationMinutes: 20,
      visibility: 'dm-only',
      objectId: 'encounter-sahuagin-patrol',
      body: 'Deploy only if the party investigates the waterline before the ambush. Good pacing pivot if the ambush resolves quickly.',
    },
    {
      id: 'step-lore-bell-rhyme',
      order: 14,
      kind: 'handout',
      track: 'parallel',
      title: 'Lore: The Bell Rhyme of the Shoals',
      durationMinutes: 3,
      visibility: 'shared',
      objectId: 'lore-bell-rhyme-shoals',
      body: "Share if the party asks about the harbor bell sound at the closing beat. Seeds the Choir Below subplot for act 3.",
    },
  ],
  notes: [
    'Serin wants the cargo identified, not an arrest made in public.',
    'If the party takes the warehouse lead, let the Watch checkpoint become a negotiation rather than a forced combat.',
  ],
  playerFacingSummary:
    'A quiet favor from the Harbor Master puts you on the rain-slick eastern pier, where someone else is already looking for the burned ledger.',
  attachments: [
    'handout-harbormasters-warning',
    'handout-burned-shipping-ledger',
    'lore-bell-rhyme-shoals',
  ],
};

export const sessions: CampaignSession[] = sessionRecords.map(
  (record, index) => {
    const number = index + 1;
    const id = `session-${number}`;
    const actId =
      number <= 7
        ? 'act-fractured-tides'
        : number <= 13
          ? 'act-glass-harbor'
          : 'act-hollow-crown';
    const shared: Pick<
      CampaignSession,
      | 'campaignId'
      | 'actId'
      | 'number'
      | 'partyLevel'
      | 'tags'
      | 'questIds'
      | 'npcIds'
      | 'factionIds'
      | 'locationIds'
      | 'encounterIds'
      | 'clueIds'
      | 'handoutIds'
    > = {
      campaignId: 'campaign-ashes-of-veyra',
      actId,
      number,
      partyLevel: number <= 3 ? 3 : number <= 7 ? 4 : 5,
      tags:
        number === 12
          ? ['Urban', 'Intrigue', 'Combat']
          : number <= 7
            ? ['Coastal', 'Discovery']
            : ['Urban', 'Intrigue'],
      questIds: [],
      npcIds: [],
      factionIds: [],
      locationIds: [],
      encounterIds: [],
      clueIds: [],
      handoutIds: [],
    };

    return {
      ...shared,
      ...record,
      id,
      ...(number === 12
        ? {
            questIds: ['quest-find-ember-key', 'quest-a-debt-in-blood'],
            npcIds: [
              'npc-captain-serin',
              'npc-selka-marr',
              'npc-oren-voss',
              'npc-elian-rook',
              'npc-mara-venn',
            ],
            factionIds: [
              'faction-harbor-watch',
              'faction-crimson-wake',
              'faction-ashen-synod',
              'faction-choir-below',
            ],
            locationIds: [
              'location-glass-harbor',
              'location-old-customs-house',
              'location-south-pier',
              'location-harbor-warehouse',
              'location-salty-mast',
            ],
            encounterIds: [
              'encounter-dockside-ambush',
              'encounter-sahuagin-patrol',
              'encounter-city-watch-checkpoint',
              'encounter-drowned-cellar',
            ],
            clueIds: [
              'clue-strange-symbol',
              'clue-smuggler-note',
              'clue-sahuagin-activity',
              'clue-broken-compass',
            ],
            handoutIds: [
              'handout-burned-shipping-ledger',
              'handout-harbormasters-warning',
              'lore-bell-rhyme-shoals',
            ],
            plan: session12Plan,
          }
        : number === 13
          ? {
              questIds: [
                'quest-find-ember-key',
                'quest-whispers-beneath-veyra',
              ],
              npcIds: ['npc-captain-serin', 'npc-oren-voss', 'npc-elian-rook'],
              factionIds: [
                'faction-harbor-watch',
                'faction-ashen-synod',
                'faction-choir-below',
              ],
              locationIds: [
                'location-old-customs-house',
                'location-harbor-warehouse',
                'location-south-pier',
              ],
              encounterIds: ['encounter-sahuagin-patrol'],
              clueIds: ['clue-sahuagin-activity', 'clue-strange-symbol'],
              handoutIds: ['lore-azure-compact', 'lore-bell-rhyme-shoals'],
            }
          : {}),
    };
  },
);
