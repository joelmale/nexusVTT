import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  decodeDraftRecord,
  getRecommendation,
  toCharacterCreationResult,
} from '@nexus/character-creator';
import {
  useCreatorRecovery,
  type CreatorDraftRepository,
} from '@/hooks/useCreatorRecovery';

describe('host creation save recovery', () => {
  it('persists an exact pending completion before saving and recovers that payload after reload', async () => {
    let stored: Awaited<ReturnType<CreatorDraftRepository['getCreatorDraft']>>;
    const repository: CreatorDraftRepository = {
      getCreatorDraft: async () =>
        stored ? structuredClone(stored) : undefined,
      saveCreatorDraft: async (record, expectedRevision) => {
        if ((stored?.revision ?? 0) !== expectedRevision)
          throw new Error('Concurrent draft');
        stored = structuredClone(record);
      },
      deleteCreatorDraft: async () => {
        stored = undefined;
      },
    };
    const recommendation = getRecommendation({
      classSlug: 'wizard',
      edition: '2024',
      name: 'Frozen hero',
    });
    const draft = recommendation.draft;
    const completion = toCharacterCreationResult(recommendation.evaluation);
    const first = renderHook(() =>
      useCreatorRecovery(repository, 'player:one'),
    );
    await waitFor(() => expect(first.result.current.phase).toBe('ready'));
    act(() => first.result.current.onDraftChange(draft));
    await act(async () => {
      await first.result.current.freezeCompletion(completion);
    });
    expect(stored).toBeDefined();
    const decoded = decodeDraftRecord(stored!.value);
    expect(decoded.status).toBe('ok');
    if (decoded.status === 'ok')
      expect(decoded.record.pendingCompletion).toEqual(completion);
    first.unmount();

    const restored = renderHook(() =>
      useCreatorRecovery(repository, 'player:one'),
    );
    await waitFor(() => expect(restored.result.current.phase).toBe('recover'));
    const changed = {
      ...completion,
      character: {
        ...completion.character,
        name: 'Changed after lost response',
      },
    };
    let recovered: typeof completion | undefined;
    await act(async () => {
      recovered = await restored.result.current.freezeCompletion(changed);
    });
    expect(recovered).toEqual(completion);
  });

  it('blocks submission when the pending payload cannot be made durable', async () => {
    const repository = {
      getCreatorDraft: vi.fn().mockResolvedValue(undefined),
      saveCreatorDraft: vi.fn().mockResolvedValue(undefined),
      deleteCreatorDraft: vi.fn(),
    };
    const recommendation = getRecommendation({
      classSlug: 'fighter',
      edition: '2024',
    });
    const hook = renderHook(() => useCreatorRecovery(repository, 'player:one'));
    await waitFor(() => expect(hook.result.current.phase).toBe('ready'));
    act(() => hook.result.current.onDraftChange(recommendation.draft));
    await act(async () => {
      await hook.result.current.flush();
    });
    repository.saveCreatorDraft.mockRejectedValueOnce(
      new Error('Storage quota exceeded'),
    );
    await act(async () => {
      await expect(
        hook.result.current.freezeCompletion(
          toCharacterCreationResult(recommendation.evaluation),
        ),
      ).rejects.toThrow('could not be stored');
    });
    expect(hook.result.current.error).toContain('quota');
  });
});
