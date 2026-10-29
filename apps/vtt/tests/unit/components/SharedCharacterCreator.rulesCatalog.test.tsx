import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  save: vi.fn(),
  convert: vi.fn(),
  catalog: vi.fn(),
  handoff: vi.fn(),
  discard: vi.fn(),
}));
vi.mock('@nexus/character-creator', () => ({
  CharacterCreator: ({
    onComplete,
  }: {
    onComplete: (result: unknown) => Promise<void>;
  }) => (
    <button
      onClick={() => {
        void onComplete({
          character: { id: 'stable', name: 'Test' },
          creationAttemptId: 'attempt',
          draftRevision: 2,
        }).catch(() => undefined);
      }}
    >
      Finish character
    </button>
  ),
  createdCharacterToNexus: mocks.convert,
  useCreatorRecovery: () => ({
    phase: 'ready',
    initialDraft: { edition: '2024' },
    flush: async () => undefined,
    freezeCompletion: async (result: unknown) => result,
    discard: mocks.discard,
  }),
}));
vi.mock('@nexus/character-creator/styles.css', () => ({}));
vi.mock('@/services/storageWorkerClient', () => ({
  storageWorkerClient: {
    getCreatorDraft: vi.fn(),
    saveCreatorDraft: vi.fn(),
    deleteCreatorDraft: vi.fn(),
  },
}));
vi.mock('@/stores/characterStore', () => ({
  useCharacterStore: {
    getState: () => ({
      saveCreatedCharacter: mocks.save,
      getCharacter: () => ({
        id: 'canonical',
        name: 'Test',
        rulesCatalogVersion: 7,
      }),
    }),
  },
}));
vi.mock('@/stores/gameStore', () => ({
  useTheme: () => 'dark',
  useGameStore: (selector: (state: { session: null }) => unknown) =>
    selector({ session: null }),
}));
vi.mock('@/services/characterHandoff', () => ({
  handoffSavedCharacter: mocks.handoff,
}));
vi.mock('@/services/rulesCatalogClient', () => ({
  getRulesCatalogVersion: mocks.catalog,
}));
vi.mock('@/utils/notifications', () => ({ toast: { success: vi.fn() } }));
import { SharedCharacterCreator } from '@/components/SharedCharacterCreator';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue('canonical');
  mocks.convert.mockReturnValue({ id: 'stable', name: 'Test' });
  mocks.catalog.mockResolvedValue(7);
  mocks.handoff.mockResolvedValue({ message: 'Accepted', status: 'accepted' });
  mocks.discard.mockResolvedValue(undefined);
});
describe('VTT creator canonical save and session checkpoint', () => {
  it('sends stable attempt metadata and hands off the server-returned canonical character', async () => {
    render(
      <SharedCharacterCreator
        playerId="player"
        onComplete={mocks.complete}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Finish character' }));
    await waitFor(() =>
      expect(mocks.complete).toHaveBeenCalledWith(
        'canonical',
        expect.objectContaining({ id: 'canonical' }),
      ),
    );
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ rulesCatalogVersion: 7 }),
      { creationAttemptId: 'attempt', draftRevision: 2 },
    );
  });
  it('retains recovery work after a rejected session handoff and retries without resaving', async () => {
    mocks.handoff
      .mockRejectedValueOnce(new Error('DM offline'))
      .mockResolvedValueOnce({ message: 'Accepted' });
    render(
      <SharedCharacterCreator
        playerId="player"
        onComplete={mocks.complete}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Finish character' }));
    await waitFor(() => expect(mocks.handoff).toHaveBeenCalledTimes(1));
    expect(mocks.discard).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Finish character' }));
    await waitFor(() => expect(mocks.complete).toHaveBeenCalledTimes(1));
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.handoff.mock.calls.map(([character]) => character.id)).toEqual(
      ['canonical', 'canonical'],
    );
  });
});
