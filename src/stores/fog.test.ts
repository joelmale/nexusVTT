import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import type { GameEvent, Scene } from '@/types/game';
import type { FogShape } from '@/types/fog';

// Same mocking convention as gameStore.test.ts / sliceIsolation.test.ts:
// avoid touching real IndexedDB / server sync from autosave timers, and
// capture what the fog actions actually send over the wire.
vi.mock('@/services/drawingPersistence', () => ({
  drawingPersistenceService: {
    saveScene: vi.fn().mockResolvedValue(undefined),
    loadAllScenes: vi.fn().mockResolvedValue([]),
    loadDrawings: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/websocket', () => ({
  webSocketService: {
    isConnected: vi.fn().mockReturnValue(true),
    sendEvent: vi.fn(),
    sendGameStateUpdate: vi.fn(),
  },
}));

import { useGameStore } from '@/stores/gameStore';
import { webSocketService } from '@/services/websocket';

const getInitialState = () => useGameStore.getState();

const makeScene = (sceneId: string): Scene => ({
  id: sceneId,
  name: 'Test Scene',
  description: '',
  visibility: 'private',
  isEditable: true,
  createdBy: 'host-id',
  roomCode: 'TEST_ROOM',
  placedTokens: [],
  placedProps: [],
  drawings: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  gridSettings: {
    enabled: true,
    size: 50,
    color: '#ffffff',
    opacity: 0.5,
    snapToGrid: true,
    showToPlayers: true,
  },
  lightingSettings: {
    enabled: false,
    globalIllumination: true,
    ambientLight: 0.5,
    darkness: 0,
  },
  isActive: true,
  playerCount: 0,
});

const makeRectShape = (id: string): FogShape => ({
  id,
  kind: 'reveal',
  shape: 'rect',
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 100 },
  ],
  createdAt: Date.now(),
});

describe('fog of war (A9)', () => {
  let sceneId: string;

  beforeEach(() => {
    useGameStore.setState(getInitialState(), true);
    vi.clearAllMocks();
    (webSocketService.isConnected as ReturnType<typeof vi.fn>).mockReturnValue(
      true,
    );
    sceneId = uuidv4();
    useGameStore.setState((state) => ({
      sceneState: {
        ...state.sceneState,
        scenes: [makeScene(sceneId)],
        activeSceneId: sceneId,
      },
    }));
  });

  describe('remote event handlers (applyEvent)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('"fog/update" applies the complete remote SceneFog to the matching scene', () => {
      const shape = makeRectShape('shape-1');
      const event: GameEvent = {
        type: 'fog/update',
        data: {
          sceneId,
          fog: { enabled: true, shapes: [shape] },
        },
      };

      const before = useGameStore.getState().sceneState.scenes[0].updatedAt;
      vi.advanceTimersByTime(1);
      useGameStore.getState().applyEvent(event);

      const scene = useGameStore.getState().sceneState.scenes[0];
      expect(scene.fog).toEqual({ enabled: true, shapes: [shape] });
      expect(scene.updatedAt).toBeGreaterThan(before);
    });

    it('"fog/update" is a full-state replace: a second event overwrites, not merges', () => {
      const shapeA = makeRectShape('shape-a');
      const shapeB = makeRectShape('shape-b');

      useGameStore.getState().applyEvent({
        type: 'fog/update',
        data: { sceneId, fog: { enabled: true, shapes: [shapeA] } },
      });
      useGameStore.getState().applyEvent({
        type: 'fog/update',
        data: { sceneId, fog: { enabled: true, shapes: [shapeB] } },
      });

      const scene = useGameStore.getState().sceneState.scenes[0];
      expect(scene.fog?.shapes).toEqual([shapeB]);
    });

    it('"fog/clear" empties shapes but preserves the enabled flag', () => {
      useGameStore.setState((state) => {
        const scenes = [...state.sceneState.scenes];
        scenes[0] = {
          ...scenes[0],
          fog: { enabled: true, shapes: [makeRectShape('s1')] },
        };
        return { sceneState: { ...state.sceneState, scenes } };
      });

      useGameStore.getState().applyEvent({
        type: 'fog/clear',
        data: { sceneId },
      });

      const scene = useGameStore.getState().sceneState.scenes[0];
      expect(scene.fog).toEqual({ enabled: true, shapes: [] });
    });

    it('ignores fog events for a scene id that does not exist', () => {
      const before = useGameStore.getState().sceneState.scenes[0];
      useGameStore.getState().applyEvent({
        type: 'fog/update',
        data: {
          sceneId: 'no-such-scene',
          fog: { enabled: true, shapes: [] },
        },
      });
      expect(useGameStore.getState().sceneState.scenes[0]).toEqual(before);
    });
  });

  describe('optimistic actions', () => {
    it('setFogEnabled applies locally and sends the complete SceneFog over fog/update', async () => {
      await useGameStore.getState().setFogEnabled(sceneId, true);

      // Optimistic local apply.
      const scene = useGameStore.getState().sceneState.scenes[0];
      expect(scene.fog).toEqual({ enabled: true, shapes: [] });

      expect(webSocketService.sendEvent).toHaveBeenCalledWith({
        type: 'fog/update',
        data: { sceneId, fog: { enabled: true, shapes: [] } },
      });
    });

    it('addFogShape appends the shape locally and sends the full updated SceneFog', async () => {
      await useGameStore.getState().setFogEnabled(sceneId, true);

      const shape = makeRectShape('shape-1');
      await useGameStore.getState().addFogShape(sceneId, shape);

      const scene = useGameStore.getState().sceneState.scenes[0];
      expect(scene.fog?.shapes).toEqual([shape]);

      const calls = (webSocketService.sendEvent as ReturnType<typeof vi.fn>)
        .mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toEqual({
        type: 'fog/update',
        data: { sceneId, fog: { enabled: true, shapes: [shape] } },
      });
    });

    it('clearFog empties shapes locally and sends fog/clear', async () => {
      await useGameStore.getState().setFogEnabled(sceneId, true);
      await useGameStore
        .getState()
        .addFogShape(sceneId, makeRectShape('shape-1'));

      await useGameStore.getState().clearFog(sceneId);

      const scene = useGameStore.getState().sceneState.scenes[0];
      expect(scene.fog).toEqual({ enabled: true, shapes: [] });

      expect(webSocketService.sendEvent).toHaveBeenLastCalledWith({
        type: 'fog/clear',
        data: { sceneId },
      });
    });

    it('addFogShape on a scene with no prior fog config defaults enabled to true', async () => {
      const shape = makeRectShape('shape-1');
      await useGameStore.getState().addFogShape(sceneId, shape);

      const scene = useGameStore.getState().sceneState.scenes[0];
      expect(scene.fog).toEqual({ enabled: true, shapes: [shape] });
    });
  });
});
