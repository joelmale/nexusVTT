import { describe, expect, it } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import {
  computeSecretStats,
  createDefaultSecretDraft,
  filterSecrets,
  resolveAttachmentLabel,
} from './secretsModel';

const baseBundle = getFixtureBundle('ashes-of-veyra', 'test')!;

describe('secretsModel', () => {
  const mockSecrets = [
    {
      id: 'sec-1',
      campaignId: baseBundle.campaignId,
      text: 'The grand vizier is actually a rakshasa in disguise.',
      attachedTo: [{ kind: 'npc', id: baseBundle.npcs[0].id }],
      revealed: false,
      revealedInSessionId: 'session-1',
    },
    {
      id: 'sec-2',
      campaignId: baseBundle.campaignId,
      text: 'The Sunken Vault flooded after the seal was broken 50 years ago.',
      attachedTo: [{ kind: 'location', id: baseBundle.locations[0].id }],
      revealed: true,
      revealedInSessionId: 'session-2',
    },
    {
      id: 'sec-3',
      campaignId: baseBundle.campaignId,
      text: 'The cult of the eclipse is funded by the merchant guild.',
      attachedTo: [{ kind: 'quest', id: baseBundle.quests[0].id }],
      revealed: false,
    },
  ];

  it('computes accurate secret statistics', () => {
    const stats = computeSecretStats(mockSecrets);
    expect(stats.total).toBe(3);
    expect(stats.unrevealed).toBe(2);
    expect(stats.revealed).toBe(1);
  });

  it('filters by status correctly', () => {
    expect(filterSecrets(mockSecrets, { status: 'all' })).toHaveLength(3);
    expect(filterSecrets(mockSecrets, { status: 'unrevealed' })).toHaveLength(2);
    expect(filterSecrets(mockSecrets, { status: 'revealed' })).toHaveLength(1);
  });

  it('filters by text query case-insensitively', () => {
    const results = filterSecrets(mockSecrets, { query: 'rakshasa' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('sec-1');
  });

  it('filters by attached kind and session', () => {
    const byNpc = filterSecrets(mockSecrets, { attachedKind: 'npc' });
    expect(byNpc).toHaveLength(1);
    expect(byNpc[0].id).toBe('sec-1');

    const bySession = filterSecrets(mockSecrets, { sessionId: 'session-2' });
    expect(bySession).toHaveLength(1);
    expect(bySession[0].id).toBe('sec-2');
  });

  it('creates clean default secret draft', () => {
    const draft = createDefaultSecretDraft('camp-1', [{ kind: 'npc', id: 'n-1' }], 'sess-1');
    expect(draft.campaignId).toBe('camp-1');
    expect(draft.text).toBe('');
    expect(draft.revealed).toBe(false);
    expect(draft.revealedInSessionId).toBe('sess-1');
    expect(draft.attachedTo).toEqual([{ kind: 'npc', id: 'n-1' }]);
  });

  it('resolves attachment label for entities', () => {
    const npcLabel = resolveAttachmentLabel(baseBundle, 'npc', baseBundle.npcs[0].id);
    expect(npcLabel).toBe(baseBundle.npcs[0].name);

    const locLabel = resolveAttachmentLabel(baseBundle, 'location', baseBundle.locations[0].id);
    expect(locLabel).toBe(baseBundle.locations[0].name);

    const unknown = resolveAttachmentLabel(baseBundle, 'custom', 'xyz');
    expect(unknown).toBe('custom (xyz)');
  });
});
