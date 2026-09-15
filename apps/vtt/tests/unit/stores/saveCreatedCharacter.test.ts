/**
 * Host-side persistence contract for characters produced by the shared
 * creator: successful saves, failed saves, and protection against duplicates.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '@nexus/character-contracts';
import { useCharacterStore } from '@/stores/characterStore';
import { toNexusCharacter } from '@nexus/character-creator';
import { fighter2014 } from '../services/forgeCharacterFixtures';

const authState = { userId: 'user-1', isAuthenticated: true };

vi.mock('@/stores/gameStoreContext', () => ({
  getGameStoreContext: () => authState,
}));

const saveCharacter = vi.fn();
vi.mock('@/services/linearFlowStorage', () => ({
  getLinearFlowStorage: () => ({
    saveCharacter,
    getBrowserId: () => 'browser-1',
  }),
}));

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  ...toNexusCharacter(fighter2014 as never, { playerId: 'user-1' }),
  ...overrides,
});

describe('characterStore.saveCreatedCharacter', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [], activeCharacterId: null });
    authState.userId = 'user-1';
    authState.isAuthenticated = true;
    saveCharacter.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves to the account, the store and the local cache', async () => {
    const character = makeCharacter();

    const id = await useCharacterStore.getState().saveCreatedCharacter(character);

    expect(id).toBe(character.id);
    expect(fetch).toHaveBeenCalledWith(
      '/api/characters',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );

    const stored = useCharacterStore.getState().characters;
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Bren Halloway');
    expect(useCharacterStore.getState().activeCharacterId).toBe(character.id);
    expect(saveCharacter).toHaveBeenCalledTimes(1);
  });

  it('assigns ownership from the signed-in user when absent', async () => {
    const character = makeCharacter({ playerId: undefined });

    await useCharacterStore.getState().saveCreatedCharacter(character);

    expect(useCharacterStore.getState().characters[0].playerId).toBe('user-1');
  });

  it('rejects and adds nothing to the store when the account save fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Database unavailable' }),
      })),
    );

    await expect(
      useCharacterStore.getState().saveCreatedCharacter(makeCharacter()),
    ).rejects.toThrow('Database unavailable');

    // No ghost character: the player can retry from the still-open wizard.
    expect(useCharacterStore.getState().characters).toHaveLength(0);
    expect(saveCharacter).not.toHaveBeenCalled();
  });

  it('still succeeds when only the local cache fails', async () => {
    saveCharacter.mockImplementationOnce(() => {
      throw new Error('IndexedDB unavailable');
    });

    await expect(
      useCharacterStore.getState().saveCreatedCharacter(makeCharacter()),
    ).resolves.toBeTruthy();

    expect(useCharacterStore.getState().characters).toHaveLength(1);
  });

  it('skips the account call for unauthenticated (guest) play', async () => {
    authState.isAuthenticated = false;

    await useCharacterStore.getState().saveCreatedCharacter(makeCharacter());

    expect(fetch).not.toHaveBeenCalled();
    expect(useCharacterStore.getState().characters).toHaveLength(1);
  });

  it('does not create a duplicate when the same character is saved twice', async () => {
    const character = makeCharacter();

    await useCharacterStore.getState().saveCreatedCharacter(character);
    await useCharacterStore.getState().saveCreatedCharacter(character);

    expect(useCharacterStore.getState().characters).toHaveLength(1);
  });

  it('clears any in-progress creation state on success', async () => {
    useCharacterStore.setState({
      creationState: {
        playerId: 'user-1',
        step: 1,
        totalSteps: 8,
        character: {},
        method: 'guided',
        isComplete: false,
      },
    });

    await useCharacterStore.getState().saveCreatedCharacter(makeCharacter());

    expect(useCharacterStore.getState().creationState).toBeNull();
  });
});
