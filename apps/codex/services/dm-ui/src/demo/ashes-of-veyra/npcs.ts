import type { CampaignNpc } from './types';

export const npcs: CampaignNpc[] = [
  {
    id: 'npc-captain-serin',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Captain Serin Dhal',
    role: 'Harbor Master',
    ancestry: 'Human',
    factionIds: ['faction-harbor-watch'],
    motivation:
      'Keep trade moving while quietly exposing corruption in the customs office.',
    relationship:
      'Cautious ally; trusts the party with a quiet eastern-pier inquiry.',
    locationIds: ['location-old-customs-house', 'location-glass-harbor'],
    sessionIds: ['session-8', 'session-10', 'session-11', 'session-12'],
    portraitFallback: 'CS',
    tags: ['Harbor Master', 'Cautious ally', 'Five backlinks'],
  },
  {
    id: 'npc-selka-marr',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Selka Marr',
    role: 'Crimson Wake broker',
    ancestry: 'Half-elf',
    factionIds: ['faction-crimson-wake'],
    motivation: "Control the Ember Key's sale without starting a faction war.",
    relationship:
      'Useful, untrusted contact; holds the terms of Mira Vale family debt.',
    locationIds: ['location-salty-mast', 'location-north-docks'],
    sessionIds: ['session-5', 'session-9', 'session-12'],
    portraitFallback: 'SM',
    tags: ['Broker', 'Useful contact', 'Debt holder'],
  },
  {
    id: 'npc-oren-voss',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Prelate Oren Voss',
    role: 'Ashen Synod envoy',
    ancestry: 'Human',
    factionIds: ['faction-ashen-synod'],
    motivation:
      'Claim the Ember Key as a holy relic before it reaches the drowned vault.',
    relationship:
      'Polite antagonist who frames every demand as an offer of help.',
    locationIds: ['location-old-customs-house', 'location-glass-harbor'],
    sessionIds: ['session-8', 'session-10', 'session-12', 'session-13'],
    portraitFallback: 'OV',
    tags: ['Envoy', 'Polite antagonist', 'Synod'],
  },
  {
    id: 'npc-neris-quill',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Neris Quill',
    role: 'Lantern Guild archivist',
    ancestry: 'Gnome',
    factionIds: ['faction-lantern-guild'],
    motivation:
      'Prove the drowned kingdom survived beneath Veyra and map its surviving wards.',
    relationship:
      'Research ally; shares findings when the party brings a verifiable lead.',
    locationIds: ['location-north-docks', 'location-fishmongers-row'],
    sessionIds: ['session-2', 'session-4', 'session-8', 'session-11'],
    portraitFallback: 'NQ',
    tags: ['Archivist', 'Research ally', 'Drowned history'],
  },
  {
    id: 'npc-elian-rook',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Warden Elian Rook',
    role: 'Harbor Watch commander',
    ancestry: 'Human',
    factionIds: ['faction-harbor-watch'],
    motivation:
      'Restore order while keeping his part in the false manifests hidden.',
    relationship: 'Secret antagonist; once Kael Ardyn superior in the Watch.',
    locationIds: ['location-old-customs-house', 'location-south-pier'],
    sessionIds: ['session-8', 'session-10', 'session-12', 'session-13'],
    portraitFallback: 'ER',
    tags: ['Commander', 'Secret antagonist', 'Former superior'],
  },
  {
    id: 'npc-mara-venn',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Old Mara Venn',
    role: 'Salty Mast proprietor',
    ancestry: 'Human',
    factionIds: [],
    motivation:
      'Protect dockworkers and collect every useful rumor before it reaches the street.',
    relationship:
      'Friendly information source; quietly shelters people fleeing the Watch.',
    locationIds: ['location-salty-mast'],
    sessionIds: ['session-6', 'session-9', 'session-11', 'session-12'],
    portraitFallback: 'MV',
    tags: ['Proprietor', 'Information source', 'Dockside community'],
  },
];
