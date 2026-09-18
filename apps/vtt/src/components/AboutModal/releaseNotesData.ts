import type { ReleaseNoteEntry } from '@/types/systemInfo';

export const RELEASE_NOTES: ReleaseNoteEntry[] = [
  {
    version: 'v0.1.0',
    releaseDate: 'September 18, 2026',
    isLatest: true,
    summary: 'System transparency modal, multiplayer sync resilience, and Dockhand homelab integration.',
    changes: [
      {
        type: 'new',
        description: 'System transparency modal with live server health, pool metrics, and changelog',
        reference: '#1580',
      },
      {
        type: 'new',
        description: 'Native HTML Popover API integration for top-layer menus and overlays',
        reference: '#1575',
      },
      {
        type: 'perf',
        description: 'Chunked and lazy-loaded vendor bundles with Rolldown manual chunks',
        reference: '#1568',
      },
      {
        type: 'fix',
        description: 'Prevent double session recovery reconnect loop on linear welcome page',
        reference: '#1562',
      },
      {
        type: 'security',
        description: 'Enforce strict Helmet CSP and cross-origin resource policy on static assets',
        reference: '#1559',
      },
    ],
  },
  {
    version: 'v0.0.9',
    releaseDate: 'July 19, 2026',
    summary: 'Durable PostgreSQL game state commit pipeline and ordered event journaling.',
    changes: [
      {
        type: 'new',
        description: 'Durable compare-and-swap game state transactions with syncToken and stateVersion',
        reference: '#1520',
      },
      {
        type: 'new',
        description: 'Per-room event journal for ordered client catch-up and replay',
        reference: '#1521',
      },
      {
        type: 'fix',
        description: 'Eliminate snapshot race conditions during rapid multi-user token drags',
        reference: '#1514',
      },
      {
        type: 'perf',
        description: 'Content-hash delta sync saving over 85% bandwidth during movement actions',
        reference: '#1508',
      },
    ],
  },
  {
    version: 'v0.0.8',
    releaseDate: 'July 2, 2026',
    summary: 'Shared character creation wizard and consolidated design tokens.',
    changes: [
      {
        type: 'new',
        description: 'Unified 5e character creator package shared across Forge and VTT',
        reference: '#1480',
      },
      {
        type: 'new',
        description: 'Design token consolidation with CSS Modules and single authoritative z-scale',
        reference: '#1476',
      },
      {
        type: 'fix',
        description: 'Correct character sheet ability modifier calculations for custom backgrounds',
        reference: '#1468',
      },
      {
        type: 'perf',
        description: 'Off-thread IndexedDB storage operations via Comlink Web Worker',
        reference: '#1455',
      },
    ],
  },
  {
    version: 'v0.0.7',
    releaseDate: 'May 14, 2026',
    summary: 'Multi-replica realtime Redis coordinator and high-availability session clustering.',
    changes: [
      {
        type: 'new',
        description: 'Redis pub/sub coordinator for cross-replica room message broadcast',
        reference: '#1410',
      },
      {
        type: 'new',
        description: 'Dynamic host leasing with automatic failover during replica restarts',
        reference: '#1412',
      },
      {
        type: 'fix',
        description: 'Prevent reconnect storms under lossy network conditions with backoff jitter',
        reference: '#1398',
      },
      {
        type: 'security',
        description: 'PostgreSQL session storage with secure cookie handling behind reverse proxies',
        reference: '#1385',
      },
    ],
  },
];
