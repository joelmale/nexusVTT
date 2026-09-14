
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '@/stores/gameStore';
import { DiceRoll } from '@/types/game';

vi.mock('@/services/drawingPersistence', () => ({
  drawingPersistenceService: {
    saveScene: vi.fn(() => Promise.resolve()),
    loadAllScenes: vi.fn(() => Promise.resolve([])),
    loadDrawings: vi.fn(() => Promise.resolve([])),
    deleteScene: vi.fn(() => Promise.resolve()),
  },
}));

describe('gameStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useGameStore.getState().reset();
  });

  it('should have the correct initial state', () => {
    const state = useGameStore.getState();
    expect(state.user.name).toBe('');
    expect(state.session).toBeNull();
    expect(state.diceRolls).toEqual([]);
    expect(state.activeTab).toBe('lobby');
    expect(state.sceneState.scenes).toEqual([]);
  });

  it('should set the user', () => {
    useGameStore.getState().setUser({ name: 'Test User' });
    const state = useGameStore.getState();
    expect(state.user.name).toBe('Test User');
  });

  it('should set the session', () => {
    const session = { roomCode: 'ABCD', hostId: '1', players: [], status: 'connected' as const };
    useGameStore.getState().setSession(session);
    const state = useGameStore.getState();
    expect(state.session).toEqual(session);
  });

  it('should add a dice roll', () => {
    const roll: DiceRoll = { id: '1', expression: '1d20', results: [10], total: 10, timestamp: Date.now(), userId: '1', userName: 'Test' };
    useGameStore.getState().addDiceRoll(roll);
    const state = useGameStore.getState();
    expect(state.diceRolls).toEqual([roll]);
  });

  it('should cap dice roll history at 50', () => {
    for (let i = 0; i < 60; i++) {
      const roll: DiceRoll = { id: `${i}`, expression: '1d20', results: [10], total: 10, timestamp: Date.now(), userId: '1', userName: 'Test' };
      useGameStore.getState().addDiceRoll(roll);
    }
    const state = useGameStore.getState();
    expect(state.diceRolls).toHaveLength(50);
  });

  it('should set the active tab', () => {
    useGameStore.getState().setActiveTab('scenes');
    const state = useGameStore.getState();
    expect(state.activeTab).toBe('scenes');
  });

  describe('scene actions', () => {
    beforeEach(() => {
      // Scene actions require an active session
      useGameStore.getState().setSession({
        roomCode: 'TEST',
        hostId: 'user-1',
        players: [],
        status: 'connected',
      });
    });

    it('should create a scene', () => {
      const sceneData = { name: 'Test Scene', description: 'A scene for testing' };
      const newScene = useGameStore.getState().createScene(sceneData);
      const state = useGameStore.getState();
      expect(state.sceneState.scenes).toHaveLength(1);
      expect(state.sceneState.scenes[0].name).toBe('Test Scene');
      expect(state.sceneState.activeSceneId).toBe(newScene.id);
    });

    it('should update a scene', () => {
      const sceneData = { name: 'Test Scene', description: 'A scene for testing' };
      const newScene = useGameStore.getState().createScene(sceneData);
      useGameStore.getState().updateScene(newScene.id, { name: 'Updated Scene' });
      const state = useGameStore.getState();
      expect(state.sceneState.scenes[0].name).toBe('Updated Scene');
    });

    it('should delete a scene', () => {
      const scene1 = useGameStore.getState().createScene({ name: 'Scene 1', description: '' });
      const scene2Id = useGameStore.getState().createScene({ name: 'Scene 2', description: '' }).id;
      useGameStore.getState().deleteScene(scene1.id);
      const state = useGameStore.getState();
      expect(state.sceneState.scenes).toHaveLength(1);
      expect(state.sceneState.scenes[0].name).toBe('Scene 2');
      expect(state.sceneState.activeSceneId).toBe(scene2Id);
    });

    it('should set the active scene', () => {
      useGameStore.getState().createScene({ name: 'Scene 1', description: '' });
      const scene2Id = useGameStore.getState().createScene({ name: 'Scene 2', description: '' }).id;
      useGameStore.getState().setActiveScene(scene2Id);
      const state = useGameStore.getState();
      expect(state.sceneState.activeSceneId).toBe(scene2Id);
    });
  });

  describe('event handling', () => {
    it('should handle dice/roll event', () => {
      const roll: DiceRoll = { id: '1', expression: '1d20', results: [10], total: 10, timestamp: Date.now(), userId: '1', userName: 'Test' };
      useGameStore.getState().applyEvent({ type: 'dice/roll', data: { roll } });
      const state = useGameStore.getState();
      expect(state.diceRolls).toEqual([roll]);
    });

    it('should handle user/join event', () => {
      const session = { roomCode: 'ABCD', hostId: '1', players: [], status: 'connected' as const };
      useGameStore.getState().setSession(session);
      const newUser = { id: '2', name: 'New User', type: 'player' as const, color: 'red', connected: true, canEditScenes: false };
      useGameStore.getState().applyEvent({ type: 'user/join', data: { user: newUser } });
      const state = useGameStore.getState();
      expect(state.session?.players).toHaveLength(1);
      expect(state.session?.players[0]).toEqual(newUser);
    });
  });
});
