/**
 * Hybrid State Manager
 *
 * Core service that manages local-first state with IndexedDB persistence
 * and seamless transition to real-time multiplayer synchronization.
 */

import type {
  PersistedGameState,
  LocalChange,
  GameAction,
  ActionResult,
  StorageAdapter,
  HybridStoreConfig,
  SyncState,
  SessionMode,
  MultiplayerSession,
} from '@/types/hybrid';
import type {
  GameState,
  Scene,
  Token,
  Drawing,
  PlacedToken,
  DiceRoll,
} from '@/types/game';
import { createIndexedDBAdapter } from './indexedDBAdapter';
import { v4 as uuidv4 } from 'uuid';

export class HybridStateManager {
  private storage: StorageAdapter;
  private config: HybridStoreConfig;
  private saveDebounceTimer: number | null = null;
  private listeners: Map<string, Set<(state: PersistedGameState) => void>> =
    new Map();
  private actionListeners: Set<
    (action: GameAction, result: ActionResult) => void
  > = new Set();

  // State
  private currentState: PersistedGameState | null = null;
  private syncState: SyncState;
  private sessionMode: SessionMode = 'local';
  private multiplayerSession: MultiplayerSession | null = null;

  constructor(config: Partial<HybridStoreConfig> = {}) {
    this.config = this.createDefaultConfig(config);
    this.storage = this.createStorageAdapter();
    this.syncState = this.createInitialSyncState();

    this.initializeState();
  }

  // =============================================================================
  // INITIALIZATION AND CONFIGURATION
  // =============================================================================

  private createDefaultConfig(
    config: Partial<HybridStoreConfig>,
  ): HybridStoreConfig {
    return {
      storage: {
        adapter: 'indexeddb',
        dbName: 'nexus-vtt-hybrid',
        version: 1,
        autoSave: true,
        saveDebounceMs: 1000,
        compressionEnabled: false,
        ...config.storage,
      },
      sync: {
        enableRealtime: true,
        conflictResolution: 'remote-wins',
        maxRetries: 3,
        retryDelayMs: 1000,
        fullSyncIntervalMs: 30000,
        heartbeatIntervalMs: 5000,
        ...config.sync,
      },
      performance: {
        maxCachedActions: 1000,
        maxSyncErrors: 100,
        stateCompressionThreshold: 100000,
        optimisticUpdates: true,
        ...config.performance,
      },
      debug: {
        enableLogging: process.env.NODE_ENV === 'development',
        logLevel: 'info',
        enableMetrics: false,
        simulateLatency: false,
        simulateErrors: false,
        ...config.debug,
      },
    };
  }

  private createStorageAdapter(): StorageAdapter {
    switch (this.config.storage.adapter) {
      case 'indexeddb':
        return createIndexedDBAdapter({
          dbName: this.config.storage.dbName,
          version: this.config.storage.version,
        });
      default:
        throw new Error(
          `Unsupported storage adapter: ${this.config.storage.adapter}`,
        );
    }
  }

  private createInitialSyncState(): SyncState {
    return {
      isSyncing: false,
      lastSyncAttempt: 0,
      lastSuccessfulSync: 0,
      syncErrors: [],
      localVersion: 0,
      remoteVersion: 0,
      hasConflicts: false,
      conflicts: [],
      resolutionStrategy: this.config.sync.conflictResolution,
    };
  }

  private async initializeState(): Promise<void> {
    try {
      // Try to load existing state from storage
      const savedState =
        await this.storage.load<PersistedGameState>('currentState');

      if (savedState) {
        this.currentState = savedState;
        this.syncState.localVersion = savedState.syncVersion;
        this.log('info', 'State loaded from storage', {
          version: savedState.syncVersion,
        });
      } else {
        // Initialize with default state
        this.currentState = this.createInitialGameState();
        await this.persistState();
        this.log('info', 'New state initialized');
      }
    } catch (error) {
      this.log('error', 'Failed to initialize state', error);
      this.currentState = this.createInitialGameState();
    }
  }

  private createInitialGameState(): PersistedGameState {
    // Import the default state from your existing store
    // This would integrate with your existing initialState
    const baseState: GameState = {
      // Note: 'view' removed - using URL-based routing now
      user: {
        id: uuidv4(),
        name: '',
        type: 'player',
        color: 'blue',
        connected: false,
      },
      session: null,
      diceRolls: [],
      activeTab: 'lobby',
      sceneState: {
        scenes: [],
        activeSceneId: null,
        camera: { x: 0, y: 0, zoom: 1 },
        followDM: true,
        activeTool: 'select',
        selectedObjectIds: [],
      },
      settings: {
        // Your existing default settings
        colorScheme: {
          id: 'default',
          name: 'Default',
          primary: '#3b82f6',
          secondary: '#1e40af',
          accent: '#f59e0b',
          surface: '#1f2937',
          text: '#f3f4f6',
        },
        theme: 'auto',
        enableGlassmorphism: true,
        reducedMotion: false,
        fontSize: 'medium',
        enableSounds: true,
        diceRollSounds: true,
        notificationSounds: true,
        masterVolume: 75,
        autoRollInitiative: true,
        showOtherPlayersRolls: true,
        diceDisappearTime: 3000,
        highlightActivePlayer: true,
        snapToGridByDefault: true,
        defaultGridSize: 50,
        allowSpectators: false,
        shareCharacterSheets: true,
        logGameSessions: true,
        maxTokensPerScene: 100,
        imageQuality: 'medium',
        enableAnimations: true,
        highContrast: false,
        screenReaderMode: false,
        keyboardNavigation: true,
        hpSync: true,
      },
      chat: {
        messages: [],
        typingUsers: [],
        unreadCount: 0,
      },
      voice: {
        channels: [],
        activeChannelId: null,
        isMuted: false,
        isDeafened: false,
        audioDevices: [],
        selectedInputDevice: null,
        selectedOutputDevice: null,
      },
      connection: {
        isConnected: false,
        quality: 'disconnected',
        latency: 0,
        packetLoss: 0,
        lastUpdate: 0,
        reconnectAttempts: 0,
      },
      isRecovering: false,
      entityVersions: new Map(),
    };

    return {
      ...baseState,
      persistenceVersion: 1,
      lastSaved: Date.now(),
      lastModified: Date.now(),
      syncVersion: 1,
      localChanges: [],
    };
  }

  // =============================================================================
  // CORE STATE MANAGEMENT
  // =============================================================================

  async getState(): Promise<PersistedGameState> {
    if (!this.currentState) {
      await this.initializeState();
    }
    return this.currentState!;
  }

  async setState(
    updater: (current: PersistedGameState) => PersistedGameState | void,
  ): Promise<void> {
    const currentState = await this.getState();
    const newState = updater(currentState) || currentState;

    // Update metadata
    newState.lastModified = Date.now();
    newState.syncVersion++;

    // Track local changes for sync
    const change: LocalChange = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: 'state-update',
      stateUpdate: newState,
      applied: true,
      synced: false,
    };

    newState.localChanges.push(change);

    // Limit local changes history
    if (
      newState.localChanges.length > this.config.performance.maxCachedActions
    ) {
      newState.localChanges = newState.localChanges.slice(
        -this.config.performance.maxCachedActions,
      );
    }

    this.currentState = newState;
    this.syncState.localVersion = newState.syncVersion;

    // Notify listeners
    this.notifyStateListeners();

    // Auto-save if enabled
    if (this.config.storage.autoSave) {
      this.debouncedSave();
    }

    this.log('debug', 'State updated', { version: newState.syncVersion });
  }

  async applyAction(action: GameAction): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      // Validate action
      const validation = this.validateAction(action);
      if (!validation.valid) {
        return {
          success: false,
          action,
          error: validation.error,
        };
      }

      // Apply action optimistically if enabled
      let rollbackState: PersistedGameState | undefined;
      if (
        this.config.performance.optimisticUpdates &&
        this.sessionMode !== 'local'
      ) {
        rollbackState = { ...(await this.getState()) };
      }

      // Apply the action
      const result = await this.executeAction(action);

      // Track the action
      if (result.success) {
        const change: LocalChange = {
          id: uuidv4(),
          timestamp: Date.now(),
          type: 'action',
          action,
          applied: true,
          synced: this.sessionMode === 'local', // Local actions are immediately "synced"
        };

        await this.setState((state) => {
          state.localChanges.push(change);
        });
      }

      // Notify action listeners
      this.notifyActionListeners(action, result);

      const duration = Date.now() - startTime;
      this.log('debug', 'Action applied', {
        type: action.type,
        success: result.success,
        duration,
      });

      return {
        ...result,
        rollback: rollbackState,
      };
    } catch (error) {
      this.log('error', 'Action failed', { action: action.type, error });
      return {
        success: false,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private validateAction(action: GameAction): {
    valid: boolean;
    error?: string;
  } {
    // Basic validation
    if (!action.id || !action.type || !action.userId) {
      return { valid: false, error: 'Invalid action: missing required fields' };
    }

    // Permission validation for multiplayer
    if (this.sessionMode !== 'local' && action.requiresAuth) {
      if (!this.multiplayerSession?.isAuthority) {
        return { valid: false, error: 'Action requires authority permissions' };
      }
    }

    return { valid: true };
  }

  private async executeAction(action: GameAction): Promise<ActionResult> {
    const currentState = await this.getState();

    switch (action.type) {
      // User actions
      case 'user/update':
        return this.handleUserUpdate(action, currentState);
      case 'user/setName':
        return this.handleUserSetName(action, currentState);
      case 'user/setColor':
        return this.handleUserSetColor(action, currentState);

      // Scene actions
      case 'scene/create':
        return this.handleSceneCreate(action, currentState);
      case 'scene/update':
        return this.handleSceneUpdate(action, currentState);
      case 'scene/delete':
        return this.handleSceneDelete(action, currentState);
      case 'scene/reorder':
        return this.handleSceneReorder(action, currentState);
      case 'scene/setActive':
        return this.handleSceneSetActive(action, currentState);

      // Camera actions
      case 'camera/update':
        return this.handleCameraUpdate(action, currentState);
      case 'camera/setFollowDM':
        return this.handleCameraSetFollowDM(action, currentState);

      // Token actions
      case 'token/place':
        return this.handleTokenPlace(action, currentState);
      case 'token/move':
        return this.handleTokenMove(action, currentState);
      case 'token/update':
        return this.handleTokenUpdate(action, currentState);
      case 'token/delete':
        return this.handleTokenDelete(action, currentState);

      // Drawing actions
      case 'drawing/create':
        return this.handleDrawingCreate(action, currentState);
      case 'drawing/update':
        return this.handleDrawingUpdate(action, currentState);
      case 'drawing/delete':
        return this.handleDrawingDelete(action, currentState);
      case 'drawing/clear':
        return this.handleDrawingClear(action, currentState);

      // Dice actions
      case 'dice/roll':
        return this.handleDiceRoll(action, currentState);
      case 'dice/clearHistory':
        return this.handleDiceClearHistory(action, currentState);

      // Settings actions
      case 'settings/update':
        return this.handleSettingsUpdate(action, currentState);
      case 'settings/reset':
        return this.handleSettingsReset(action, currentState);

      // Session actions
      case 'session/create':
        return this.handleSessionCreate(action, currentState);
      case 'session/join':
        return this.handleSessionJoin(action, currentState);
      case 'session/leave':
        return this.handleSessionLeave(action, currentState);
      case 'session/kickPlayer':
        return this.handleSessionKickPlayer(action, currentState);
      case 'session/updatePermissions':
        return this.handleSessionUpdatePermissions(action, currentState);

      // Batch actions
      case 'batch/execute':
        return this.handleBatchExecute(action, currentState);

      // Sync actions
      case 'sync/requestFull':
        return this.handleSyncRequestFull(action, currentState);
      case 'sync/heartbeat':
        return this.handleSyncHeartbeat(action, currentState);

      default:
        return {
          success: false,
          action,
          error: `Unknown action type: ${action.type}`,
        };
    }
  }

  // =============================================================================
  // USER ACTION HANDLERS
  // =============================================================================

  private async handleUserUpdate(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as { updates: Partial<typeof _state.user> };

    await this.setState((currentState) => {
      Object.assign(currentState.user, payload.updates);
    });

    return {
      success: true,
      action,
      newState: { user: (await this.getState()).user },
    };
  }

  private async handleUserSetName(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as { name: string };

    await this.setState((currentState) => {
      currentState.user.name = payload.name;
    });

    return { success: true, action };
  }

  private async handleUserSetColor(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as { color: string };

    await this.setState((currentState) => {
      currentState.user.color = payload.color;
    });

    return { success: true, action };
  }

  // =============================================================================
  // SCENE ACTION HANDLERS
  // =============================================================================

  private async handleSceneCreate(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as { scene: Scene };

    await this.setState((currentState) => {
      currentState.sceneState.scenes.push(payload.scene);
      if (!currentState.sceneState.activeSceneId) {
        currentState.sceneState.activeSceneId = payload.scene.id;
      }
    });

    return {
      success: true,
      action,
      newState: { sceneState: (await this.getState()).sceneState },
    };
  }

  private async handleSceneUpdate(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as {
      sceneId: string;
      updates: Partial<Scene>;
    };

    await this.setState((currentState) => {
      const sceneIndex = currentState.sceneState.scenes.findIndex(
        (s) => s.id === payload.sceneId,
      );
      if (sceneIndex >= 0) {
        Object.assign(
          currentState.sceneState.scenes[sceneIndex],
          payload.updates,
        );
      }
    });

    return { success: true, action };
  }

  private async handleSceneDelete(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as { sceneId: string };

    await this.setState((currentState) => {
      const sceneIndex = currentState.sceneState.scenes.findIndex(
        (s) => s.id === payload.sceneId,
      );
      if (sceneIndex >= 0) {
        currentState.sceneState.scenes.splice(sceneIndex, 1);
        if (currentState.sceneState.activeSceneId === payload.sceneId) {
          currentState.sceneState.activeSceneId =
            currentState.sceneState.scenes[0]?.id || null;
        }
      }
    });

    return { success: true, action };
  }

  private async handleSceneReorder(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as { fromIndex: number; toIndex: number };

    await this.setState((currentState) => {
      const scenes = currentState.sceneState.scenes;
      const [moved] = scenes.splice(payload.fromIndex, 1);
      scenes.splice(payload.toIndex, 0, moved);
    });

    return { success: true, action };
  }

  private async handleSceneSetActive(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as { sceneId: string };

    await this.setState((currentState) => {
      currentState.sceneState.activeSceneId = payload.sceneId;
    });

    return { success: true, action };
  }

  // =============================================================================
  // CAMERA ACTION HANDLERS
  // =============================================================================

  private async handleCameraUpdate(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as {
      camera: Partial<typeof _state.sceneState.camera>;
    };

    await this.setState((currentState) => {
      Object.assign(currentState.sceneState.camera, payload.camera);
    });

    return { success: true, action };
  }

  private async handleCameraSetFollowDM(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as { follow: boolean };

    await this.setState((currentState) => {
      currentState.sceneState.followDM = payload.follow;
    });

    return { success: true, action };
  }

  // =============================================================================
  // TOKEN ACTION HANDLERS
  // =============================================================================

  private async handleTokenPlace(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as { sceneId: string; token: Token };

    await this.setState((currentState) => {
      const scene = currentState.sceneState.scenes.find(
        (s) => s.id === payload.sceneId,
      );
      if (scene) {
        scene.placedTokens.push(payload.token as unknown as PlacedToken);
      }
    });

    return { success: true, action };
  }

  private async handleTokenMove(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as {
      sceneId: string;
      tokenId: string;
      position: { x: number; y: number };
      rotation?: number;
    };

    await this.setState((currentState) => {
      const scene = currentState.sceneState.scenes.find(
        (s) => s.id === payload.sceneId,
      );
      if (scene) {
        const token = scene.placedTokens.find((t) => t.id === payload.tokenId);
        if (token) {
          token.x = payload.position.x;
          token.y = payload.position.y;
          if (payload.rotation !== undefined) {
            token.rotation = payload.rotation;
          }
        }
      }
    });

    return { success: true, action };
  }

  private async handleTokenUpdate(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as {
      sceneId: string;
      tokenId: string;
      updates: Partial<Token>;
    };

    await this.setState((currentState) => {
      const scene = currentState.sceneState.scenes.find(
        (s) => s.id === payload.sceneId,
      );
      if (scene) {
        const tokenIndex = scene.placedTokens.findIndex(
          (t) => t.id === payload.tokenId,
        );
        if (tokenIndex >= 0) {
          Object.assign(scene.placedTokens[tokenIndex], payload.updates);
        }
      }
    });

    return { success: true, action };
  }

  private async handleTokenDelete(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as { sceneId: string; tokenId: string };

    await this.setState((currentState) => {
      const scene = currentState.sceneState.scenes.find(
        (s) => s.id === payload.sceneId,
      );
      if (scene) {
        const tokenIndex = scene.placedTokens.findIndex(
          (t) => t.id === payload.tokenId,
        );
        if (tokenIndex >= 0) {
          scene.placedTokens.splice(tokenIndex, 1);
        }
      }
    });

    return { success: true, action };
  }

  // =============================================================================
  // DRAWING ACTION HANDLERS
  // =============================================================================

  private async handleDrawingCreate(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as { sceneId: string; drawing: Drawing };

    await this.setState((currentState) => {
      const scene = currentState.sceneState.scenes.find(
        (s) => s.id === payload.sceneId,
      );
      if (scene) {
        scene.drawings.push(payload.drawing);
      }
    });

    return { success: true, action };
  }

  private async handleDrawingUpdate(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as {
      sceneId: string;
      drawingId: string;
      updates: Partial<Drawing>;
    };

    await this.setState((currentState) => {
      const scene = currentState.sceneState.scenes.find(
        (s) => s.id === payload.sceneId,
      );
      if (scene) {
        const drawingIndex = scene.drawings.findIndex(
          (d) => d.id === payload.drawingId,
        );
        if (drawingIndex >= 0) {
          Object.assign(scene.drawings[drawingIndex], payload.updates);
        }
      }
    });

    return { success: true, action };
  }

  private async handleDrawingDelete(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as { sceneId: string; drawingId: string };

    await this.setState((currentState) => {
      const scene = currentState.sceneState.scenes.find(
        (s) => s.id === payload.sceneId,
      );
      if (scene) {
        const drawingIndex = scene.drawings.findIndex(
          (d) => d.id === payload.drawingId,
        );
        if (drawingIndex >= 0) {
          scene.drawings.splice(drawingIndex, 1);
        }
      }
    });

    return { success: true, action };
  }

  private async handleDrawingClear(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as { sceneId: string; layer?: string };

    await this.setState((currentState) => {
      const scene = currentState.sceneState.scenes.find(
        (s) => s.id === payload.sceneId,
      );
      if (scene) {
        if (payload.layer) {
          scene.drawings = scene.drawings.filter(
            (d) => d.layer !== payload.layer,
          );
        } else {
          scene.drawings = [];
        }
      }
    });

    return { success: true, action };
  }

  // =============================================================================
  // DICE ACTION HANDLERS
  // =============================================================================

  private async handleDiceRoll(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as {
      roll: { id: string; expression: string; [key: string]: unknown };
    };

    // Validate the dice roll
    if (!payload.roll || !payload.roll.id || !payload.roll.expression) {
      return {
        success: false,
        action,
        error: 'Invalid dice roll data',
      };
    }

    await this.setState((currentState) => {
      currentState.diceRolls.unshift(payload.roll as unknown as DiceRoll);
      // Keep only last 100 rolls
      if (currentState.diceRolls.length > 100) {
        currentState.diceRolls = currentState.diceRolls.slice(0, 100);
      }
    });

    return { success: true, action };
  }

  private async handleDiceClearHistory(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    await this.setState((currentState) => {
      currentState.diceRolls = [];
    });

    return { success: true, action };
  }

  // =============================================================================
  // SETTINGS ACTION HANDLERS
  // =============================================================================

  private async handleSettingsUpdate(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as {
      settings: Partial<typeof _state.settings>;
    };

    await this.setState((currentState) => {
      Object.assign(currentState.settings, payload.settings);
    });

    return { success: true, action };
  }

  private async handleSettingsReset(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    await this.setState((currentState) => {
      // Reset to default settings from createInitialGameState
      const defaultState = this.createInitialGameState();
      currentState.settings = defaultState.settings;
    });

    return { success: true, action };
  }

  // =============================================================================
  // SESSION ACTION HANDLERS
  // =============================================================================

  private async handleSessionCreate(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    // This would integrate with the hosting logic
    return { success: true, action };
  }

  private async handleSessionJoin(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    // This would integrate with the join logic
    return { success: true, action };
  }

  private async handleSessionLeave(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    // This would integrate with the leave logic
    return { success: true, action };
  }

  private async handleSessionKickPlayer(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    // This would integrate with multiplayer session management
    return { success: true, action };
  }

  private async handleSessionUpdatePermissions(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    // This would integrate with multiplayer session management
    return { success: true, action };
  }

  // =============================================================================
  // BATCH AND SYNC ACTION HANDLERS
  // =============================================================================

  private async handleBatchExecute(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    const payload = action.payload as { actions: GameAction[] };

    const results: ActionResult[] = [];
    for (const batchAction of payload.actions) {
      const result = await this.executeAction(batchAction);
      results.push(result);
      if (!result.success) {
        return {
          success: false,
          action,
          error: `Batch action failed: ${result.error}`,
          metadata: { failedAction: batchAction, results },
        };
      }
    }

    return {
      success: true,
      action,
      metadata: { results },
    };
  }

  private async handleSyncRequestFull(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    // This would trigger a full state sync in multiplayer mode
    return { success: true, action };
  }

  private async handleSyncHeartbeat(
    action: GameAction,
    _state: PersistedGameState,
  ): Promise<ActionResult> {
    // This would update the last activity timestamp
    await this.setState((currentState) => {
      if (currentState.session && 'lastActivity' in currentState.session) {
        (currentState.session as MultiplayerSession).lastActivity = Date.now();
      }
    });

    return { success: true, action };
  }

  // =============================================================================
  // PERSISTENCE
  // =============================================================================

  private debouncedSave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = window.setTimeout(() => {
      this.persistState();
    }, this.config.storage.saveDebounceMs);
  }

  private async persistState(): Promise<void> {
    if (!this.currentState) return;

    try {
      this.currentState.lastSaved = Date.now();
      await this.storage.save('currentState', this.currentState);
      this.log('debug', 'State persisted to storage');
    } catch (error) {
      this.log('error', 'Failed to persist state', error);
    }
  }

  async forceSave(): Promise<void> {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    await this.persistState();
  }

  // =============================================================================
  // MULTIPLAYER SESSION MANAGEMENT
  // =============================================================================

  async startHosting(): Promise<MultiplayerSession> {
    if (this.sessionMode !== 'local') {
      throw new Error('Already in multiplayer mode');
    }

    const session: MultiplayerSession = {
      mode: 'hosting',
      sessionId: uuidv4(),
      roomCode: this.generateRoomCode(),
      hostId: (await this.getState()).user.id,
      players: [],
      status: 'connecting',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      authorityId: (await this.getState()).user.id,
      isAuthority: true,
      connectionState: 'disconnected',
      connectionAttempts: 0,
      fullSyncRequired: false,
      pendingActions: [],
    };

    this.multiplayerSession = session;
    this.sessionMode = 'hosting';

    await this.setState((state) => {
      state.session = session;
    });

    this.log('info', 'Started hosting session', {
      sessionId: session.sessionId,
      roomCode: session.roomCode,
    });

    return session;
  }

  async joinSession(roomCode: string): Promise<MultiplayerSession> {
    if (this.sessionMode !== 'local') {
      throw new Error('Already in multiplayer mode');
    }

    const session: MultiplayerSession = {
      mode: 'joined',
      sessionId: uuidv4(), // Will be updated when connected
      roomCode,
      hostId: '', // Will be updated when connected
      players: [],
      status: 'connecting',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      authorityId: '', // Will be updated when connected
      isAuthority: false,
      connectionState: 'disconnected',
      connectionAttempts: 0,
      fullSyncRequired: true,
      pendingActions: [],
    };

    this.multiplayerSession = session;
    this.sessionMode = 'joined';

    await this.setState((state) => {
      state.session = session;
    });

    this.log('info', 'Joining session', { roomCode });

    return session;
  }

  async leaveSession(): Promise<void> {
    if (this.sessionMode === 'local') return;

    this.multiplayerSession = null;
    this.sessionMode = 'local';

    await this.setState((state) => {
      state.session = null;
    });

    this.log('info', 'Left multiplayer session');
  }

  // =============================================================================
  // EVENT LISTENERS
  // =============================================================================

  subscribe(
    key: string,
    listener: (state: PersistedGameState) => void,
  ): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    return () => {
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        keyListeners.delete(listener);
        if (keyListeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  subscribeToActions(
    listener: (action: GameAction, result: ActionResult) => void,
  ): () => void {
    this.actionListeners.add(listener);
    return () => this.actionListeners.delete(listener);
  }

  private notifyStateListeners(): void {
    if (!this.currentState) return;

    for (const [key, listeners] of this.listeners.entries()) {
      for (const listener of listeners) {
        try {
          listener(this.currentState);
        } catch (error) {
          this.log('error', `State listener error for key ${key}`, error);
        }
      }
    }
  }

  private notifyActionListeners(
    action: GameAction,
    result: ActionResult,
  ): void {
    for (const listener of this.actionListeners) {
      try {
        listener(action, result);
      } catch (error) {
        this.log('error', 'Action listener error', error);
      }
    }
  }

  // =============================================================================
  // UTILITIES
  // =============================================================================

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private log(
    level: 'error' | 'warn' | 'info' | 'debug',
    message: string,
    data?: unknown,
  ): void {
    if (!this.config.debug.enableLogging) return;

    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const configLevel = levels[this.config.debug.logLevel];
    const messageLevel = levels[level];

    if (messageLevel <= configLevel) {
      const timestamp = new Date().toISOString();
      const prefix = `[HybridStateManager][${level.toUpperCase()}][${timestamp}]`;

      if (data) {
        console[level](prefix, message, data);
      } else {
        console[level](prefix, message);
      }
    }
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  async destroy(): Promise<void> {
    // Clear timers
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    // Save final state
    await this.forceSave();

    // Clear listeners
    this.listeners.clear();
    this.actionListeners.clear();

    // Leave any active session
    await this.leaveSession();

    this.log('info', 'HybridStateManager destroyed');
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createHybridStateManager(
  config?: Partial<HybridStoreConfig>,
): HybridStateManager {
  return new HybridStateManager(config);
}
