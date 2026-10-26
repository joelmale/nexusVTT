import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  user: { id: 'player', type: 'player' },
  session: undefined as { roomCode: string } | undefined,
  sceneState: {
    activeSceneId: 'scene',
    scenes: [] as Array<{
      id: string;
      placedTokens: Array<{ characterId: string; visibleToPlayers: boolean }>;
    }>,
  },
}));
const send = vi.hoisted(() => vi.fn());
vi.mock('@/stores/gameStore', () => ({
  useGameStore: { getState: () => state },
}));
vi.mock('@/services/playerIntentClient', () => ({ sendPlayerIntent: send }));
import { handoffSavedCharacter } from '@/services/characterHandoff';
import type { Character } from '@nexus/character-contracts';
const character = { id: 'saved-canonical', name: 'Test' } as Character;

beforeEach(() => {
  send.mockReset();
  state.session = undefined;
  state.user.type = 'player';
  state.sceneState.scenes = [];
});
describe('saved character session handoff', () => {
  it('distinguishes library saving from session acceptance', async () => {
    expect(await handoffSavedCharacter(character)).toMatchObject({
      status: 'saved',
      hasToken: false,
    });
    expect(send).not.toHaveBeenCalled();
  });
  it('reports a saved but unaccepted character and allows a retry with the same identity', async () => {
    state.session = { roomCode: 'TEST' };
    send
      .mockResolvedValueOnce({ status: 'rejected', reason: 'host-offline' })
      .mockResolvedValueOnce({ status: 'applied' });
    await expect(handoffSavedCharacter(character)).rejects.toThrow(
      'Character saved',
    );
    expect(await handoffSavedCharacter(character)).toMatchObject({
      status: 'accepted',
      hasToken: false,
      message: expect.stringContaining('Ask the DM'),
    });
    expect(send.mock.calls.map(([intent]) => intent.character.id)).toEqual([
      'saved-canonical',
      'saved-canonical',
    ]);
  });
  it('recognizes a visible linked token in the active scene only', async () => {
    state.session = { roomCode: 'TEST' };
    state.user.type = 'host';
    state.sceneState.scenes = [
      {
        id: 'scene',
        placedTokens: [{ characterId: character.id, visibleToPlayers: true }],
      },
    ];
    expect(await handoffSavedCharacter(character)).toMatchObject({
      status: 'accepted',
      hasToken: true,
    });
    expect(send).not.toHaveBeenCalled();
  });
});
