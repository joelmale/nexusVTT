import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/drawingPersistence', () => ({
  drawingPersistenceService: {
    loadDrawings: vi.fn().mockResolvedValue([]),
    saveDrawings: vi.fn().mockResolvedValue(undefined),
  },
}));
const sendEvent = vi.hoisted(() => vi.fn());
vi.mock('@/services/websocket', () => ({
  webSocketService: { sendEvent, isConnected: () => true },
}));

import { useGameStore } from '@/stores/gameStore';
import { createPlacedToken, type Token } from '@/types/token';

const SCENE = 'scene-1';

function tokenPosition(tokenId: string) {
  const token = useGameStore
    .getState()
    .sceneState.scenes[0].placedTokens.find((t) => t.id === tokenId);
  return token ? { x: token.x, y: token.y } : undefined;
}

describe('peer token/move events', () => {
  let tokenId: string;

  beforeEach(() => {
    const token = createPlacedToken(
      { id: 'base', name: 'Mia' } as Token,
      { x: 500, y: 500 },
      SCENE,
      'ROOM',
      'player-1',
    );
    tokenId = token.id;
    useGameStore.setState((state) => {
      state.sceneState.scenes = [
        {
          id: SCENE,
          name: 'Scene',
          placedTokens: [token],
          placedProps: [],
          drawings: [],
        } as never,
      ];
      state.sceneState.activeSceneId = SCENE;
    });
    sendEvent.mockReset();
  });

  it("applies a peer's move even though it carries the peer's updateId", () => {
    useGameStore.getState().applyEvent({
      type: 'token/move',
      data: {
        sceneId: SCENE,
        tokenId,
        position: { x: 150, y: 300 },
        updateId: 'token-move-from-another-client',
        expectedVersion: 0,
      },
    });
    expect(tokenPosition(tokenId)).toEqual({ x: 150, y: 300 });
  });

  it('treats an echo of our own pending move as a confirmation', async () => {
    useGameStore
      .getState()
      .moveTokenOptimistic(SCENE, tokenId, { x: 50, y: 50 });
    await vi.waitFor(() => expect(sendEvent).toHaveBeenCalled());
    const updateId = (
      sendEvent.mock.calls.at(-1)?.[0] as { data: { updateId: string } }
    )?.data.updateId;

    // A stale echo with our id must not re-apply the old position.
    useGameStore.getState().applyEvent({
      type: 'token/move',
      data: {
        sceneId: SCENE,
        tokenId,
        position: { x: 999, y: 999 },
        updateId,
        expectedVersion: 0,
      },
    });
    expect(tokenPosition(tokenId)).toEqual({ x: 50, y: 50 });
  });
});
