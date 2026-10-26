import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '@/stores/gameStore';
import type { Scene } from '@/types/game';
import {
  loadEncounterRun,
  placeEncounterTokens,
  type EncounterRunView,
} from '@/services/encounterRunClient';
const original = useGameStore.getState();
const data: EncounterRunView = {
  run: {
    id: 'run',
    stage: 'deployed',
    currentRound: 1,
    currentTurnIndex: 0,
    participants: [{ actorId: 'actor', initiativeRoll: 0 }],
  },
  actors: [
    {
      id: 'actor',
      name: 'Saved goblin',
      currentHp: 5,
      maxHp: 7,
      payload: {
        monsterData: { size: 'Small' },
        placement: { sceneId: 'scene', x: 100, y: 200, hidden: true },
      },
    },
  ],
};
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => structuredClone(data) }),
  );
  useGameStore.setState({
    user: { ...original.user, id: 'dm', type: 'host' },
    session: {
      roomCode: 'ROOM',
      campaignId: 'campaign',
      hostId: 'dm',
      players: [],
      status: 'connected',
    },
    sceneState: {
      ...original.sceneState,
      activeSceneId: 'scene',
      scenes: [{ id: 'scene', placedTokens: [] } as unknown as Scene],
    },
    placeToken: vi.fn(),
    syncGameStateToServer: vi.fn(),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useGameStore.setState(original, true);
});
describe('committed encounter scene projection', () => {
  it('uses stable actor IDs, saved HP, visibility and an embedded base token for reconnects', async () => {
    await placeEncounterTokens('campaign', 'run');
    const place = vi.mocked(useGameStore.getState().placeToken);
    expect(place).toHaveBeenCalledWith(
      'scene',
      expect.objectContaining({
        id: 'actor',
        tokenId: 'actor',
        visibleToPlayers: false,
        x: 100,
        y: 200,
        currentStats: { hp: 5 },
        baseToken: expect.objectContaining({
          id: 'actor',
          name: 'Saved goblin',
          size: 'small',
        }),
      }),
    );
    const placed = place.mock.calls[0][1];
    useGameStore.setState({
      sceneState: {
        ...useGameStore.getState().sceneState,
        scenes: [{ id: 'scene', placedTokens: [placed] } as unknown as Scene],
      },
    });
    await placeEncounterTokens('campaign', 'run');
    expect(place).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().syncGameStateToServer).toHaveBeenCalled();
  });
  it('rejects placement outside the host campaign', async () => {
    useGameStore.setState({ user: { ...original.user, type: 'player' } });
    await expect(placeEncounterTokens('campaign', 'run')).rejects.toThrow(
      'as DM',
    );
    expect(useGameStore.getState().placeToken).not.toHaveBeenCalled();
  });
  it('rejects a missing scene before projecting any actor', async () => {
    const broken = structuredClone(data);
    broken.actors.push({
      ...broken.actors[0],
      id: 'other',
      payload: { placement: { sceneId: 'missing', x: 0, y: 0, hidden: false } },
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => broken,
    } as Response);
    await expect(placeEncounterTokens('campaign', 'run')).rejects.toThrow(
      'scene is unavailable',
    );
    expect(useGameStore.getState().placeToken).not.toHaveBeenCalled();
  });
  it('reports failed reads instead of returning a demo encounter', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(loadEncounterRun('campaign', 'run')).rejects.toThrow(
      'committed encounter',
    );
  });
});
