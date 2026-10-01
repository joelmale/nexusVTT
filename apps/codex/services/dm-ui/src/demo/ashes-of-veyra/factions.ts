import type { CampaignFaction } from './types';

export const factions: CampaignFaction[] = [
  {
    id: 'faction-harbor-watch',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Harbor Watch',
    publicFace:
      'Customs, patrols, and port security. Respected by shopkeepers, resented by anyone who has paid a berth fee twice.',
    hiddenAgenda:
      'Warden Rook diverts confiscated relics to private buyers and rewrites manifests when a seizure would embarrass a friend. Sergeant Corr and Captain Serin are the honest minority.',
    leaderNpcId: 'npc-elian-rook',
    alliedFactionIds: ['faction-lantern-guild', 'faction-gilded-concord'],
    rivalFactionIds: ['faction-crimson-wake', 'faction-ashen-synod'],
    locationIds: [
      'location-glass-harbor',
      'location-old-customs-house',
      'location-south-pier',
      'location-fishmongers-row',
    ],
    questIds: ['quest-find-ember-key', 'quest-clear-kaels-name'],
    status: 'unknown',
  },
  {
    id: 'faction-crimson-wake',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'The Crimson Wake',
    publicFace: 'Smugglers, dockside fixers, and discreet cargo brokers.',
    hiddenAgenda:
      'Wants leverage over every faction, not open rule of the city. Selka keeps the peace by selling secrets; Kestrel Ruhn wants the key seized outright and is willing to split the Wake to do it.',
    leaderNpcId: 'npc-selka-marr',
    alliedFactionIds: [],
    rivalFactionIds: [
      'faction-harbor-watch',
      'faction-ashen-synod',
      'faction-gilded-concord',
    ],
    locationIds: [
      'location-salty-mast',
      'location-north-docks',
      'location-harbor-warehouse',
    ],
    questIds: ['quest-find-ember-key', 'quest-a-debt-in-blood'],
    status: 'neutral',
  },
  {
    id: 'faction-ashen-synod',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Ashen Synod',
    publicFace:
      'Temple relief, funerary rites, and historical stewardship. Their relief house feeds four hundred dock families a week.',
    hiddenAgenda:
      'Believes the Hollow Crown can restore divine authority and has been forging customs paper to move relics toward the bay. A quiet faction inside the clergy doubts Voss.',
    leaderNpcId: 'npc-oren-voss',
    alliedFactionIds: [],
    rivalFactionIds: ['faction-crimson-wake', 'faction-harbor-watch'],
    locationIds: [
      'location-glass-harbor',
      'location-old-customs-house',
      'location-synod-relief-house',
    ],
    questIds: ['quest-find-ember-key', 'quest-ash-and-ink'],
    status: 'opposition',
  },
  {
    id: 'faction-lantern-guild',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Lantern Guild',
    publicFace: 'Navigators, scholars, lighthouse keepers, and chartmakers.',
    hiddenAgenda:
      'Maps passages into the drowned city before any faction can claim them, and hoards the survey notes that would make the Concord salvage claim worthless.',
    leaderNpcId: 'npc-neris-quill',
    alliedFactionIds: ['faction-harbor-watch'],
    rivalFactionIds: ['faction-choir-below', 'faction-gilded-concord'],
    locationIds: [
      'location-north-docks',
      'location-glass-harbor',
      'location-fractured-spire',
      'location-lantern-waystation',
    ],
    questIds: [
      'quest-fractured-spire',
      'quest-whispers-beneath-veyra',
      'quest-lantern-road-escort',
      'quest-passage-to-veyra',
    ],
    status: 'ally',
  },
  {
    id: 'faction-choir-below',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Choir Below',
    publicFace: "A sailors' superstition about bells heard beneath a calm sea.",
    hiddenAgenda:
      'A real cult awakening something beneath the crown vault. Members are drowned-touched survivors who hear a court that wants to be released.',
    leaderNpcId: 'npc-ysolde-marrow',
    alliedFactionIds: [],
    rivalFactionIds: ['faction-lantern-guild', 'faction-sunken-reach'],
    locationIds: [
      'location-south-pier',
      'location-old-customs-house',
      'location-flooded-undercroft',
      'location-black-shoals',
    ],
    questIds: ['quest-whispers-beneath-veyra'],
    status: 'unknown',
  },
  {
    id: 'faction-gilded-concord',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Gilded Concord',
    publicFace:
      'A league of counting-houses that underwrites cargo, insures hulls and keeps the harbor solvent.',
    hiddenAgenda:
      'Owns the Azure Compact salvage claim on paper and intends to enforce it the instant the vault opens. Will buy any faction that can deliver the key, and burn any that cannot.',
    leaderNpcId: 'npc-halden-brask',
    alliedFactionIds: ['faction-harbor-watch'],
    rivalFactionIds: ['faction-crimson-wake', 'faction-lantern-guild'],
    locationIds: ['location-counting-hall', 'location-glass-harbor'],
    questIds: ['quest-passage-to-veyra', 'quest-find-ember-key'],
    status: 'neutral',
  },
  {
    id: 'faction-sunken-reach',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Sunken Reach Tribes',
    publicFace:
      'Sahuagin raiders blamed for every lost net and missing skiff between the shoals and the harbor mouth.',
    hiddenAgenda:
      'Their baron guards the drowned vault from the Choir Below and has been burying warning cairns along the approaches. They would trade intelligence for surface help, if anyone stopped fighting long enough to ask.',
    alliedFactionIds: [],
    rivalFactionIds: ['faction-choir-below'],
    locationIds: ['location-black-shoals', 'location-south-pier'],
    questIds: ['quest-survive-the-shoals'],
    status: 'unknown',
  },
];
