import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '@nexus/character-contracts';
import { configureGameStoreContext } from '@/stores/gameStoreContext';
import { useCharacterStore } from '@/stores/characterStore';

const importFromFiles = vi.hoisted(() => vi.fn());
vi.mock('@/services/characterImport', () => ({
  characterImportService: { importFromFiles },
}));

beforeEach(() => {
  useCharacterStore.getState().reset();
  configureGameStoreContext(() => ({ userId: 'owner', isAuthenticated: true }));
  importFromFiles.mockResolvedValue({
    successful: 1,
    failed: 0,
    results: [
      {
        success: true,
        character: {
          id: 'import-alias',
          name: 'Imported wizard',
          playerId: 'owner',
        } as Character,
      },
    ],
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  configureGameStoreContext(() => ({ userId: '', isAuthenticated: false }));
});

describe('imported character account identity', () => {
  it('adopts the canonical ID before publishing an unassigned party character', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ id: 'canonical', data: { id: 'canonical' } }),
        }),
    );
    await useCharacterStore
      .getState()
      .importCharactersFromFiles([], { unassigned: true });
    expect(useCharacterStore.getState().characters).toMatchObject([
      { id: 'canonical', name: 'Imported wizard', playerId: undefined },
    ]);
    expect(
      useCharacterStore.getState().getCharacter('import-alias'),
    ).toBeUndefined();
    // Reimporting the same account record does not publish a second local alias.
    await useCharacterStore
      .getState()
      .importCharactersFromFiles([], { unassigned: true });
    expect(useCharacterStore.getState().characters).toHaveLength(1);
  });

  it('retains the usable local import and reports an account save failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
    const result = await useCharacterStore
      .getState()
      .importCharactersFromFiles([]);
    expect(result.errors).toEqual([
      'Failed to save Imported wizard to your account: Offline',
    ]);
    expect(useCharacterStore.getState().characters).toMatchObject([
      { id: 'import-alias', playerId: 'owner' },
    ]);
  });
});
