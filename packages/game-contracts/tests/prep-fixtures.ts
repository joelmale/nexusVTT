export const GLASS_HARBOR_IDS = {
  campaign: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  sessionPlan: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  harborScene: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  harborWarning: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  docksideEncounter: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  missingEntry: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
} as const;

const timestamp = '2026-09-25T12:00:00.000Z';

export const glassHarborWarningFixture: unknown = {
  id: GLASS_HARBOR_IDS.harborWarning,
  campaignId: GLASS_HARBOR_IDS.campaign,
  schemaVersion: 1,
  revision: 2,
  kind: 'note',
  title: "Harbormaster's Warning",
  visibility: 'dm-only',
  content: {
    format: 'lexical',
    schemaVersion: 1,
    value: {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'Watch the eastern pier without involving the Watch.',
              },
            ],
          },
        ],
      },
    },
  },
  links: [],
  tags: ['glass-harbor', 'captain-serin'],
  createdAt: timestamp,
  updatedAt: timestamp,
};

export const glassHarborSceneFixture: unknown = {
  id: GLASS_HARBOR_IDS.harborScene,
  campaignId: GLASS_HARBOR_IDS.campaign,
  schemaVersion: 1,
  revision: 4,
  name: 'Glass Harbor Docks',
  backgroundAssetRef: {
    target: 'asset',
    assetId: 'asset-glass-harbor-docks-map',
  },
  grid: {
    enabled: true,
    type: 'square',
    size: 100,
    offsetX: 0,
    offsetY: 0,
    snapToGrid: true,
  },
  lighting: {
    enabled: true,
    globalIllumination: false,
    ambientLight: 0.35,
    darkness: 0.65,
  },
  fogPreset: {
    mode: 'concealed',
    revealedShapes: [],
  },
  createdAt: timestamp,
  updatedAt: timestamp,
};

export const glassHarborSessionPlanFixture: unknown = {
  id: GLASS_HARBOR_IDS.sessionPlan,
  campaignId: GLASS_HARBOR_IDS.campaign,
  schemaVersion: 1,
  revision: 3,
  title: 'Session 12 - The Glass Harbor',
  status: 'ready',
  steps: [
    {
      id: '10000000-0000-4000-8000-000000000001',
      type: 'reminder',
      title: 'Opening recap',
      estimatedMinutes: 10,
      visibility: 'players',
      text: 'Re-establish the burned ledger and pressure from the factions.',
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      type: 'activate-scene',
      title: 'Glass Harbor Docks',
      estimatedMinutes: 5,
      visibility: 'players',
      sceneTemplateRef: {
        target: 'campaign-object',
        campaignId: GLASS_HARBOR_IDS.campaign,
        id: GLASS_HARBOR_IDS.harborScene,
        revision: 4,
      },
    },
    {
      id: '10000000-0000-4000-8000-000000000003',
      type: 'open-entry',
      title: "Harbormaster's Warning",
      estimatedMinutes: 10,
      visibility: 'dm-only',
      entryRef: {
        target: 'campaign-object',
        campaignId: GLASS_HARBOR_IDS.campaign,
        id: GLASS_HARBOR_IDS.harborWarning,
        revision: 2,
      },
    },
    {
      id: '10000000-0000-4000-8000-000000000004',
      type: 'deploy-encounter',
      title: 'Dockside Ambush',
      estimatedMinutes: 30,
      visibility: 'dm-only',
      encounterRef: {
        kind: 'encounter',
        id: GLASS_HARBOR_IDS.docksideEncounter,
        revision: 5,
      },
    },
    {
      id: '10000000-0000-4000-8000-000000000005',
      type: 'share-handout',
      title: 'Burned Shipping Ledger',
      estimatedMinutes: 5,
      visibility: 'players',
      assetRef: {
        target: 'asset',
        assetId: 'asset-burned-shipping-ledger',
      },
    },
  ],
  dependencies: [
    {
      target: 'campaign-object',
      campaignId: GLASS_HARBOR_IDS.campaign,
      id: GLASS_HARBOR_IDS.harborScene,
      revision: 4,
    },
    {
      target: 'campaign-object',
      campaignId: GLASS_HARBOR_IDS.campaign,
      id: GLASS_HARBOR_IDS.harborWarning,
      revision: 2,
    },
    {
      target: 'definition',
      ref: {
        kind: 'encounter',
        id: GLASS_HARBOR_IDS.docksideEncounter,
        revision: 5,
      },
    },
    {
      target: 'asset',
      assetId: 'asset-burned-shipping-ledger',
    },
    {
      target: 'rules-entity',
      entityType: 'monster',
      ruleset: '2024',
      slug: 'bandit',
      catalogVersion: 1,
    },
    {
      target: 'rules-entity',
      entityType: 'monster',
      ruleset: '2014',
      slug: 'bandit-captain',
      catalogVersion: 1,
    },
  ],
  createdAt: timestamp,
  updatedAt: timestamp,
};

// This is structurally valid but points at an object that a repository lookup
// will not find. It lets later publishing tests distinguish parsing from
// dependency resolution.
export const glassHarborBrokenLinkFixture: unknown = {
  ...(glassHarborSessionPlanFixture as object),
  id: '12121212-1212-4212-8212-121212121212',
  status: 'draft',
  dependencies: [
    {
      target: 'campaign-object',
      campaignId: GLASS_HARBOR_IDS.campaign,
      id: GLASS_HARBOR_IDS.missingEntry,
      revision: 1,
    },
  ],
};
