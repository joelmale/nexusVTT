import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Scene, User } from '@/types/game';
import type { Character } from '@/types/character';
import { createEmptyCharacter } from '@/types/character';
import type { InitiativeState } from '@/types/initiative';
import { createInitiativeEntry } from '@/types/initiative';
import type {
  PersistedGameState,
  SessionRecoveryData,
} from '@/services/sessionPersistence';

// Mock the persistence sinks so no IndexedDB / localStorage is touched and we
// can capture what saveSessionState serializes / feed loadSessionState.
vi.mock('@/services/drawingPersistence', () => ({
  drawingPersistenceService: {
    saveScene: vi.fn().mockResolvedValue(undefined),
    loadAllScenes: vi.fn().mockResolvedValue([]),
    loadDrawings: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/sessionPersistence', () => ({
  sessionPersistenceService: {
    saveSession: vi.fn(),
    saveGameState: vi.fn().mockResolvedValue(undefined),
    getRecoveryData: vi.fn(),
  },
}));

vi.mock('@/services/websocket', () => ({
  webSocketService: {
    isConnected: vi.fn().mockReturnValue(true),
    sendGameStateUpdate: vi.fn(),
  },
}));

// Import after the mocks so the store and stores wire up against them.
import { useGameStore } from './gameStore';
import { useCharacterStore } from './characterStore';
import { useInitiativeStore } from './initiativeStore';
import { sessionPersistenceService } from '@/services/sessionPersistence';
import { webSocketService } from '@/services/websocket';
import { initializeGameStateSyncRuntime } from '@/services/gameStateSyncRuntime';

// ---- Fixtures --------------------------------------------------------------

const makeScene = (): Scene => ({
  id: 'scene-1',
  name: 'Test Scene',
  description: '',
  visibility: 'private',
  isEditable: true,
  createdBy: 'host-id',
  roomCode: 'ABCD',
  placedTokens: [],
  placedProps: [],
  drawings: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  gridSettings: {
    enabled: true,
    size: 50,
    color: '#fff',
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

const makeCharacter = (): Character => ({
  ...createEmptyCharacter('player-1'),
  id: 'char-1',
  name: 'Aragorn',
  level: 5,
});

const hostUser: User = {
  id: 'host-id',
  name: 'Host',
  type: 'host',
  color: 'red',
  connected: true,
};

/** Flush microtasks + one macrotask so the fire-and-forget websocket send runs. */
const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

// ---- Store reset helpers ---------------------------------------------------

const emptyInitiative: Partial<InitiativeState> = {
  isActive: false,
  isPaused: false,
  round: 0,
  entries: [],
  activeEntryId: null,
  history: [],
};

describe('gameStore session persistence (characters + initiative round-trip)', () => {
  beforeEach(() => {
    initializeGameStateSyncRuntime();
    vi.clearAllMocks();
    // clearAllMocks resets implementations too, so restore the async defaults.
    vi.mocked(sessionPersistenceService.saveGameState).mockResolvedValue(
      undefined,
    );
    (webSocketService.isConnected as ReturnType<typeof vi.fn>).mockReturnValue(
      true,
    );

    // Reset the foreign stores that the snapshot reads from / writes to.
    useCharacterStore.setState({ characters: [] });
    useInitiativeStore.setState(emptyInitiative);

    // Put the game store into a saveable state: an active session with a scene.
    useGameStore.setState({
      user: hostUser,
      session: {
        roomCode: 'ABCD',
        hostId: 'host-id',
        players: [{ ...hostUser, canEditScenes: true }],
        status: 'connected',
      },
    });
    useGameStore.setState((state) => ({
      sceneState: {
        ...state.sceneState,
        scenes: [makeScene()],
        activeSceneId: 'scene-1',
      },
    }));
  });

  it('saveSessionState serializes non-empty characters and initiative to IndexedDB and the server', async () => {
    const character = makeCharacter();
    const entry = createInitiativeEntry('Goblin', 'monster', 15, {
      maxHP: 7,
      currentHP: 7,
    });

    // Populate the source-of-truth stores.
    useCharacterStore.setState({ characters: [character] });
    useInitiativeStore.setState({
      isActive: true,
      round: 2,
      entries: [entry],
      activeEntryId: entry.id,
    });

    useGameStore.getState().saveSessionState();

    // --- IndexedDB snapshot (synchronous fire-and-forget) ---
    expect(sessionPersistenceService.saveGameState).toHaveBeenCalledTimes(1);
    const savedPayload = vi.mocked(sessionPersistenceService.saveGameState).mock
      .calls[0][0];

    const savedCharacters = savedPayload.characters as Character[];
    expect(savedCharacters).toHaveLength(1);
    expect(savedCharacters[0].id).toBe('char-1');

    const savedInitiative = savedPayload.initiative as InitiativeState;
    expect(savedInitiative.isActive).toBe(true);
    expect(savedInitiative.round).toBe(2);
    expect(savedInitiative.entries).toHaveLength(1);
    expect(savedInitiative.entries[0].name).toBe('Goblin');
    // The snapshot must not leak store action methods.
    expect(savedInitiative).not.toHaveProperty('addEntry');

    // --- Server snapshot (async via dynamic import of the websocket service) ---
    await flushAsync();
    expect(webSocketService.sendGameStateUpdate).toHaveBeenCalledTimes(1);
    const sentPayload = vi.mocked(webSocketService.sendGameStateUpdate).mock
      .calls[0][0];
    expect((sentPayload.characters as Character[])[0].id).toBe('char-1');
    expect((sentPayload.initiative as InitiativeState).entries).toHaveLength(1);
  });

  it('loadSessionState rehydrates the character and initiative stores', async () => {
    const character = makeCharacter();
    const entry = createInitiativeEntry('Orc', 'monster', 12, {
      maxHP: 15,
      currentHP: 9,
    });

    const persistedGameState: PersistedGameState = {
      characters: [character],
      initiative: {
        isActive: true,
        isPaused: false,
        round: 3,
        entries: [entry],
        activeEntryId: entry.id,
        history: [],
        autoAdvanceTurns: false,
        showPlayerHP: true,
        allowPlayerInitiative: true,
        sortByInitiative: true,
      } satisfies InitiativeState,
      scenes: [makeScene()],
      activeSceneId: 'scene-1',
      settings: {},
      lastUpdated: Date.now(),
      stateVersion: 1,
    };

    const recovery: SessionRecoveryData = {
      session: null,
      gameState: persistedGameState,
      isValid: true,
      canReconnect: false,
    };
    vi.mocked(sessionPersistenceService.getRecoveryData).mockResolvedValueOnce(
      recovery,
    );

    // Sanity: stores start empty (as they would on a fresh page load).
    expect(useCharacterStore.getState().characters).toHaveLength(0);
    expect(useInitiativeStore.getState().entries).toHaveLength(0);

    await useGameStore.getState().loadSessionState();

    // Characters restored into the character store.
    const restoredChars = useCharacterStore.getState().characters;
    expect(restoredChars).toHaveLength(1);
    expect(restoredChars[0].id).toBe('char-1');

    // Combat state restored into the initiative store, methods preserved.
    const initiative = useInitiativeStore.getState();
    expect(initiative.isActive).toBe(true);
    expect(initiative.round).toBe(3);
    expect(initiative.entries).toHaveLength(1);
    expect(initiative.entries[0].name).toBe('Orc');
    expect(typeof initiative.addEntry).toBe('function');
  });

  it("saveSessionState/loadSessionState round-trips a scene's fog config (A9)", async () => {
    // Fog rides scene->gameState JSONB persistence automatically: it's just
    // another optional field on Scene, serialized/restored the same way as
    // gridSettings/backgroundImage/placedTokens (no fog-specific plumbing
    // needed in saveSessionState/loadSessionState).
    const fog: Scene['fog'] = {
      enabled: true,
      shapes: [
        {
          id: 'shape-1',
          kind: 'reveal',
          shape: 'rect',
          points: [
            { x: 0, y: 0 },
            { x: 50, y: 50 },
          ],
          createdAt: Date.now(),
        },
      ],
    };

    useGameStore.setState((state) => ({
      sceneState: {
        ...state.sceneState,
        scenes: [{ ...state.sceneState.scenes[0], fog }],
      },
    }));

    useGameStore.getState().saveSessionState();

    // --- IndexedDB snapshot includes the fog field on the scene ---
    expect(sessionPersistenceService.saveGameState).toHaveBeenCalledTimes(1);
    const savedPayload = vi.mocked(sessionPersistenceService.saveGameState).mock
      .calls[0][0];
    const savedScenes = savedPayload.scenes as Scene[];
    expect(savedScenes[0].fog).toEqual(fog);

    // --- Server snapshot also carries fog ---
    await flushAsync();
    const sentPayload = vi.mocked(webSocketService.sendGameStateUpdate).mock
      .calls[0][0];
    const sentScenes = (sentPayload.sceneState?.scenes ?? []) as Scene[];
    expect(sentScenes[0].fog).toEqual(fog);

    // --- loadSessionState restores it from the recovered snapshot ---
    useGameStore.setState((state) => ({
      sceneState: {
        ...state.sceneState,
        scenes: [{ ...state.sceneState.scenes[0], fog: undefined }],
      },
    }));

    vi.mocked(sessionPersistenceService.getRecoveryData).mockResolvedValueOnce({
      session: null,
      gameState: {
        characters: [],
        initiative: {},
        scenes: savedScenes,
        activeSceneId: 'scene-1',
        settings: {},
        lastUpdated: Date.now(),
        stateVersion: 1,
      },
      isValid: true,
      canReconnect: false,
    });

    await useGameStore.getState().loadSessionState();

    const restoredScene = useGameStore.getState().sceneState.scenes[0];
    expect(restoredScene.fog).toEqual(fog);
  });

  it('loadSessionState does not clobber existing characters when the snapshot has none (legacy payload)', async () => {
    const existing = makeCharacter();
    useCharacterStore.setState({ characters: [existing] });

    const legacyGameState: PersistedGameState = {
      characters: [],
      initiative: {},
      scenes: [makeScene()],
      activeSceneId: 'scene-1',
      settings: {},
      lastUpdated: Date.now(),
      stateVersion: 1,
    };
    vi.mocked(sessionPersistenceService.getRecoveryData).mockResolvedValueOnce({
      session: null,
      gameState: legacyGameState,
      isValid: true,
      canReconnect: false,
    });

    await useGameStore.getState().loadSessionState();

    // Empty persisted characters must not wipe characters already in the store.
    expect(useCharacterStore.getState().characters).toHaveLength(1);
    expect(useCharacterStore.getState().characters[0].id).toBe('char-1');
  });
});
