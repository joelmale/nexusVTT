import type { CampaignHandout } from './types';

export const handouts: CampaignHandout[] = [
  {
    id: 'handout-burned-shipping-ledger',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Burned Shipping Ledger',
    kind: 'handout',
    summary:
      'A smoke-damaged customs copy naming the Dawn Petrel and pier 6; several rows are deliberately missing.',
    content: [
      'The surviving entry lists the Dawn Petrel, a night arrival, and pier 6. The cargo is recorded as kiln glass, though the weight is wrong for the listed crates.',
      'A scorched line in the margin reads: "third bell, east chain." The neighboring names have been cut away with a narrow blade.',
    ],
    visibility: 'shared',
    sessionIds: ['session-11', 'session-12'],
    clueIds: ['clue-smuggler-note', 'clue-strange-symbol'],
    questIds: ['quest-find-ember-key'],
    locationIds: [
      'location-fishmongers-row',
      'location-south-pier',
      'location-harbor-warehouse',
    ],
    factionIds: ['faction-harbor-watch', 'faction-crimson-wake'],
  },
  {
    id: 'handout-harbormasters-warning',
    campaignId: 'campaign-ashes-of-veyra',
    title: "Harbormaster's Warning",
    kind: 'handout',
    summary:
      'A private note from Serin asking the party to watch the eastern pier without involving the Watch.',
    content: [
      'The eastern pier changes hands at dusk. Watch the cargo, not the people; I need to know which vessel carried the ash-marked crate.',
      'Do not involve the Watch. If Rook learns I sent you, the manifest will disappear before morning.',
    ],
    visibility: 'shared',
    sessionIds: ['session-12'],
    clueIds: ['clue-smuggler-note'],
    questIds: ['quest-find-ember-key'],
    locationIds: ['location-south-pier', 'location-old-customs-house'],
    factionIds: ['faction-harbor-watch'],
  },
  {
    id: 'handout-port-authority-writ',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Port Authority Entry Writ',
    kind: 'handout',
    summary:
      'An official stamped permit granting access through warehouse district gates during restricted hours.',
    content: [
      'Issued under the seal of the Veyra Port Authority. Bearer is authorized passage through Gates 3 through 7 between second and fourth bell.',
      'A handwritten endorsement at the bottom notes: "Approved by Inspector Vane for dry cargo inspection only."',
    ],
    visibility: 'shared',
    sessionIds: ['session-12'],
    clueIds: ['clue-smuggler-note'],
    questIds: ['quest-find-ember-key'],
    locationIds: ['location-harbor-warehouse', 'location-south-pier'],
    factionIds: ['faction-harbor-watch'],
  },
  {
    id: 'handout-unsigned-letter-pier6',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Mysterious Unsigned Letter (pier 6)',
    kind: 'handout',
    summary:
      'A hastily penned message recovered near pier 6 referencing the third bell cargo exchange.',
    content: [
      'The exchange happens at the third bell by the east chain mooring. Bring the secondary key or the arrangement is void.',
      'Do not trust the red lanterns. If you are followed into the warehouse, scatter toward the fishmongers.',
    ],
    visibility: 'shared',
    sessionIds: ['session-12'],
    clueIds: ['clue-smuggler-note', 'clue-strange-symbol'],
    questIds: ['quest-find-ember-key'],
    locationIds: ['location-south-pier'],
    factionIds: ['faction-crimson-wake'],
  },
  {
    id: 'lore-azure-compact',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'The Azure Compact',
    kind: 'lore',
    summary:
      'A historical treaty that divided salvage rights after the sinking of old Veyra.',
    content: [
      'The Compact grants the harbor city rights to wreckage above the old tide line, while sealed royal property below it belongs to no living house.',
      'Its witness marks match the blue-green ward lines Lira has found around the Ember Key references.',
    ],
    visibility: 'shared',
    sessionIds: ['session-4', 'session-8', 'session-10'],
    clueIds: ['clue-strange-symbol'],
    questIds: ['quest-fractured-spire', 'quest-find-ember-key'],
    locationIds: ['location-old-customs-house', 'location-glass-harbor'],
    factionIds: ['faction-lantern-guild', 'faction-ashen-synod'],
  },
  {
    id: 'lore-bell-rhyme-shoals',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Bell-Rhyme of the Shoals',
    kind: 'lore',
    summary:
      'A children song whose four beats match the drowned cult signal recorded beneath the harbor.',
    content: [
      'One for the mast and two for the chain, three for the door below the rain; four when the harbor answers back, then follow the sound through the black.',
      'Mara remembers hearing the final beat from the cellar grate at low tide.',
    ],
    visibility: 'dm-only',
    sessionIds: ['session-6', 'session-9', 'session-12'],
    clueIds: ['clue-sahuagin-activity'],
    questIds: ['quest-whispers-beneath-veyra'],
    locationIds: ['location-salty-mast', 'location-south-pier'],
    factionIds: ['faction-choir-below'],
  },
];
