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
    // ── MAIN TIMELINE ─────────────────────────────────────────────────────────
    // These steps advance the session spine in order and are gated by
    // currentStepIndex in the activation record.
    {
      id: '10000000-0000-4000-8000-000000000001',
      type: 'reminder',
      track: 'main',
      title: 'Opening recap',
      estimatedMinutes: 10,
      visibility: 'players',
      text: 'Re-establish the burned ledger and pressure from the factions.',
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      type: 'activate-scene',
      track: 'main',
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
      track: 'main',
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
      track: 'main',
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
      track: 'main',
      title: 'Burned Shipping Ledger',
      estimatedMinutes: 5,
      visibility: 'players',
      assetRef: {
        target: 'asset',
        assetId: 'asset-burned-shipping-ledger',
      },
    },

    // ── PARALLEL THREADS ──────────────────────────────────────────────────────
    // Available at any time during the session — these are NOT gated by the
    // main beat sequence and do NOT count toward the spine progress bar.
    // The DM can toggle any of these done independently in any order.

    // 1. Active major quest reference — open when needed for context
    {
      id: '20000000-0000-4000-8000-000000000001',
      type: 'open-entry',
      track: 'parallel',
      title: 'Quest: Find the Ember Key',
      estimatedMinutes: 0,
      visibility: 'dm-only',
      entryRef: {
        target: 'campaign-object',
        campaignId: GLASS_HARBOR_IDS.campaign,
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000099',
        revision: 1,
      },
    },

    // 2. Secondary quest — resolution may span multiple sessions
    {
      id: '20000000-0000-4000-8000-000000000002',
      type: 'open-entry',
      track: 'parallel',
      title: "Quest: Mira's Debt to the Crimson Wake",
      estimatedMinutes: 0,
      visibility: 'dm-only',
      entryRef: {
        target: 'campaign-object',
        campaignId: GLASS_HARBOR_IDS.campaign,
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000098',
        revision: 2,
      },
    },

    // 3. Handout triggered by environment interaction (warehouse inspection)
    {
      id: '20000000-0000-4000-8000-000000000003',
      type: 'share-handout',
      track: 'parallel',
      title: 'Port Authority Entry Writ',
      estimatedMinutes: 2,
      visibility: 'players',
      assetRef: {
        target: 'asset',
        assetId: 'asset-port-authority-writ',
      },
    },

    // 4. Ambient mystery handout — surface whenever pacing allows
    {
      id: '20000000-0000-4000-8000-000000000004',
      type: 'share-handout',
      track: 'parallel',
      title: 'Mysterious Unsigned Letter (pier 6)',
      estimatedMinutes: 2,
      visibility: 'players',
      assetRef: {
        target: 'asset',
        assetId: 'asset-unsigned-letter-pier6',
      },
    },

    // 5. Non-binary decision point — no on-the-spot resolution required
    {
      id: '20000000-0000-4000-8000-000000000005',
      type: 'reminder',
      track: 'parallel',
      title: 'Decision: Trust Selka Marr or report to the Watch?',
      estimatedMinutes: 0,
      visibility: 'dm-only',
      text: 'If the party asks Selka for help deciphering the ledger she will ask for the Ember Key in return. Note their instinct and let it breathe — no forced resolution needed this session.',
    },

    // 6. Optional encounter — can replace or augment the main ambush
    {
      id: '20000000-0000-4000-8000-000000000006',
      type: 'deploy-encounter',
      track: 'parallel',
      title: 'Optional: Sahuagin Patrol (eastern mooring)',
      estimatedMinutes: 20,
      visibility: 'dm-only',
      encounterRef: {
        kind: 'encounter',
        id: 'eeeeeeee-eeee-4eee-8eee-000000000099',
        revision: 2,
      },
    },

    // 7. Lore handout — share if the party asks about the harbor bell
    {
      id: '20000000-0000-4000-8000-000000000007',
      type: 'share-handout',
      track: 'parallel',
      title: 'Lore: The Bell Rhyme of the Shoals',
      estimatedMinutes: 3,
      visibility: 'players',
      assetRef: {
        target: 'asset',
        assetId: 'lore-bell-rhyme-shoals',
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
