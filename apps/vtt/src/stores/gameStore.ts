import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

enableMapSet();

import type {
  PlayerCharacter,
  GameConfig,
  Scene,
  Drawing,
  PlacedToken,
  PlacedProp,
  TokenMoveEvent,
  SceneFog,
} from '@/types/game';
import type { Character } from '@nexus/character-contracts';
import type { InitiativeState } from '@/types/initiative';
import { v4 as uuidv4 } from 'uuid';
import { drawingPersistenceService } from '@/services/drawingPersistence';
import { sessionPersistenceService } from '@/services/sessionPersistence';
import { getLinearFlowStorage } from '@/services/linearFlowStorage';
// Cross-store reads for session snapshots. Both modules only reference each
// other inside runtime functions, so the import cycle is safe (live bindings).
import { useCharacterStore } from '@/stores/characterStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
// Content-hash-chained delta-sync engine. Cycle-safe: gameStateSync only reads
// this module's exports (useGameStore, buildInitiativeSnapshot) inside functions.
import { gameStateSyncEngine } from '@/services/gameStateSync';
import { configureGameStoreContext } from '@/stores/gameStoreContext';
import { eventHandlers } from '@/stores/gameEventHandlers';
import type { GameStore, PendingUpdate } from '@/stores/game/types';
import {
  clearSessionFromStorage,
  getBrowserId,
  initialState,
  loadSessionFromStorage,
  saveSessionToStorage,
} from '@/stores/game/initialState';
import { createAuthSlice } from '@/stores/game/authSlice';
import { createCharactersSlice } from '@/stores/game/charactersSlice';
import { createDevSlice } from '@/stores/game/devSlice';
import { createSettingsSlice } from '@/stores/game/settingsSlice';
import { createChatSlice } from '@/stores/game/chatSlice';
import { createVoiceSlice } from '@/stores/game/voiceSlice';


/**
 * Build a serializable snapshot of the initiative/combat state, picking only
 * the state fields (no action methods) so it round-trips cleanly through
 * IndexedDB and the server. Used by the session save and restore-rebroadcast
 * flows.
 */
export function buildInitiativeSnapshot(): InitiativeState {
  const s = useInitiativeStore.getState();
  return {
    isActive: s.isActive,
    isPaused: s.isPaused,
    round: s.round,
    entries: s.entries,
    activeEntryId: s.activeEntryId,
    history: s.history,
    autoAdvanceTurns: s.autoAdvanceTurns,
    showPlayerHP: s.showPlayerHP,
    allowPlayerInitiative: s.allowPlayerInitiative,
    sortByInitiative: s.sortByInitiative,
  };
}


const sceneAutosaveTimers = new Map<string, number>();
let serverSyncTimer: number | null = null;

const scheduleSceneAutosave = (
  sceneId: string,
  getState: () => GameStore,
): void => {
  const existing = sceneAutosaveTimers.get(sceneId);
  if (existing) {
    window.clearTimeout(existing);
  }

  const timer = window.setTimeout(() => {
    const scene = getState().sceneState.scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    const plainScene = JSON.parse(JSON.stringify(scene));
    drawingPersistenceService.saveScene(plainScene).catch((error) => {
      console.error('Failed to persist scene changes:', error);
    });
  }, 800);

  sceneAutosaveTimers.set(sceneId, timer);
};

const scheduleServerSync = (getState: () => GameStore): void => {
  if (serverSyncTimer) {
    window.clearTimeout(serverSyncTimer);
  }

  serverSyncTimer = window.setTimeout(() => {
    getState().syncGameStateToServer();
  }, 1000);
};

const scheduleCampaignPersistence = (
  sceneId: string,
  getState: () => GameStore,
): void => {
  scheduleSceneAutosave(sceneId, getState);
  scheduleServerSync(getState);
};


// Store the restored session but DON'T mutate initialState
// The store will merge it during creation to avoid corrupting initialState
const restoredSession = loadSessionFromStorage();
if (restoredSession) {
  console.log(
    '✅ Loaded session from storage (will merge during store creation)',
  );
}

export const useGameStore = create<GameStore>()(
  immer((set, get) => {
    // Pending updates for optimistic UI
    const pendingUpdates = new Map<string, PendingUpdate>();

    return {
      ...initialState,
      // Merge restored session without mutating initialState
      ...(restoredSession || {}),

      // Auth Actions — extracted to src/stores/game/authSlice.ts
      ...createAuthSlice(set, get),

      /**
       * Update user data in the store
       *
       * Note: This no longer automatically changes views. Components should
       * use React Router's navigate() to change pages after setting user data.
       *
       * @param userData - Partial user data to merge
       */
      setUser: (userData) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('👤 setUser:', userData);
        }

        set((state) => {
          Object.assign(state.user, userData);
        });

        // Navigation is now handled by components using React Router
      },

      setSession: (session) => {
        set((state) => {
          state.session = session;
        });
      },

      addDiceRoll: (roll) => {
        set((state) => {
          state.diceRolls.unshift(roll);
          // Keep only last 50 rolls
          if (state.diceRolls.length > 50) {
            state.diceRolls = state.diceRolls.slice(0, 50);
          }
        });
      },

      setActiveTab: (tab) => {
        set((state) => {
          state.activeTab = tab;
        });
      },

      applyEvent: (event) => {
        console.log('Applying event:', event.type, event.data); // Debug log

        // Check if this event is confirming an optimistic update
        if (event.type === 'token/move') {
          const tokenMoveData = event.data as TokenMoveEvent['data'];
          if (tokenMoveData.updateId) {
            // This is a confirmation of our optimistic update
            get().confirmUpdate(tokenMoveData.updateId);
            return; // Don't apply the event since we already applied it optimistically
          }
        }

        const handler = eventHandlers[event.type];
        if (handler) {
          set((state) => {
            handler(state, event.data);
          });
        } else {
          console.warn('Unknown event type:', event.type, event.data);
        }
      },

      reset: () => {
        set(() => ({
          ...initialState,
          user: {
            ...initialState.user,
            id: getBrowserId(), // Use stable browser ID
          },
        }));
      },
      resetSessionForExpiredRoom: () => {
        const shouldPreserveUser = get().isAuthenticated;

        set((state) => {
          state.session = null;
          state.connection = initialState.connection;
          if (shouldPreserveUser) {
            state.user.connected = false;
          } else {
            state.user = {
              ...initialState.user,
              id: getBrowserId(),
            };
          }
        });

        clearSessionFromStorage();
        sessionPersistenceService.clearAll();
        // Also drop the reconnection context, or the WebSocket auto-reconnect
        // loop re-joins the dead room and re-creates the state just cleared.
        try {
          localStorage.removeItem('nexus-connection-context');
        } catch (error) {
          console.warn('Failed to clear connection context:', error);
        }
      },

      // App Flow Actions (from appFlowStore)

      /**
       * Join an existing game room via WebSocket
       *
       * @param roomCode - The room code to join
       * @param character - Optional character to join with
       * @returns The joined room code
       */
      joinRoomWithCode: async (
        roomCode: string,
        character?: PlayerCharacter,
      ): Promise<string> => {
        try {
          // Import webSocketService
          const { webSocketService } = await import('@/services/websocket');

          console.log(
            '🎮 Joining room:',
            roomCode,
            'with character:',
            character?.name,
          );

          // Get current user info to pass to server
          const { user } = get();

          // Connect to WebSocket (player mode)
          await webSocketService.connect(
            roomCode,
            'player',
            undefined, // campaignId
            user.id, // userId
            user.name, // userName
          );

          // Wait for session/joined event from server
          console.log('✅ Joined room:', roomCode);

          // Update state
          set((state) => {
            if (character) {
              state.selectedCharacter = character;
            }
            state.user.connected = true;
          });

          // Save session to localStorage for refresh recovery
          saveSessionToStorage(get());

          // NOTE: Session state is already set by the session/joined event handler
          // which includes the correct players list from the server.
          // We don't need to call setSession here as it would overwrite that data.

          // Load room-specific scenes and drawings from storage
          try {
            const roomScenes =
              await drawingPersistenceService.loadAllScenes(roomCode);
            if (roomScenes.length > 0) {
              set((state) => {
                state.sceneState.scenes = roomScenes;
                // Set the first scene as active if no active scene is set
                if (!state.sceneState.activeSceneId && roomScenes.length > 0) {
                  state.sceneState.activeSceneId = roomScenes[0].id;
                }
              });
              console.log(
                `📂 Loaded ${roomScenes.length} scenes for room ${roomCode}`,
              );

              // Load drawings for each scene
              for (const scene of roomScenes) {
                try {
                  const drawings = await drawingPersistenceService.loadDrawings(
                    scene.id,
                    roomCode,
                  );
                  if (drawings.length > 0) {
                    set((state) => {
                      const sceneIndex = state.sceneState.scenes.findIndex(
                        (s) => s.id === scene.id,
                      );
                      if (sceneIndex >= 0) {
                        state.sceneState.scenes[sceneIndex].drawings = drawings;
                      }
                    });
                    console.log(
                      `📂 Loaded ${drawings.length} drawings for scene ${scene.id}`,
                    );
                  }
                } catch (drawingError) {
                  console.warn(
                    `Failed to load drawings for scene ${scene.id}:`,
                    drawingError,
                  );
                }
              }
            }
          } catch (storageError) {
            console.warn(
              'Failed to load room data from storage:',
              storageError,
            );
          }

          // If character provided, mark it as recently used
          if (character) {
            const characters = get().getSavedCharacters();
            const updated = characters.map((c) =>
              c.id === character.id ? { ...c, lastUsed: Date.now() } : c,
            );
            localStorage.setItem('nexus-characters', JSON.stringify(updated));

            // Auto-place token for character (deferred to allow scene load)
            setTimeout(() => {
              const activeSceneId = get().sceneState.activeSceneId;
              if (activeSceneId) {
                get().autoPlaceCharacterToken(character.id, activeSceneId);
              }
            }, 500);
          }

          return roomCode;
        } catch (error) {
          console.error('Failed to join room:', error);
          throw error;
        }
      },

      /**
       * Create a new game room via WebSocket
       *
       * @param config - Game configuration
       * @param clearExistingData - Whether to clear IndexedDB data (legacy)
       * @returns The created room code
       */
      createGameRoom: async (
        config: GameConfig,
        clearExistingData: boolean = false, // Default false with PostgreSQL - scenes come from DB
      ) => {
        try {
          // With PostgreSQL architecture, scenes and user data come from the database.
          // IndexedDB clearing is only needed for legacy/development scenarios.
          const storage = getLinearFlowStorage();

          if (clearExistingData) {
            await storage.clearGameData();
          } else if (process.env.NODE_ENV === 'development') {
            const existingScenes = storage.getScenes();
            if (existingScenes.length > 0) {
              console.log(
                `🎮 Found ${existingScenes.length} IndexedDB scenes (legacy/dev data)`,
              );
            }
          }

          // Import webSocketService
          const { webSocketService } = await import('@/services/websocket');

          console.log('🎮 Creating game room with WebSocket connection');

          // Connect to WebSocket (host mode) - server will generate room code
          // Pass campaign ID if provided in config
          const { user } = get();
          const preferredRoomCode = config.preferredRoomCode?.toUpperCase();
          await webSocketService.connect(
            preferredRoomCode,
            'host',
            config.campaignId,
            user.id,
            user.name,
            preferredRoomCode ? 'host' : undefined,
          );

          // Wait for session/created event from server
          const session = await webSocketService.waitForSessionCreated();

          const roomCode = session.roomCode;
          console.log('✅ Room created:', roomCode);

          // Update state
          set((state) => {
            state.gameConfig = config;
            state.user.connected = true;
            if (state.session && config.campaignId) {
              state.session.campaignId = config.campaignId;
            }
          });

          // Try to restore game state from IndexedDB if available
          // This allows resuming a campaign with local changes that haven't been saved to server
          const recoveryData =
            await sessionPersistenceService.getRecoveryData();
          console.log('🔍 Checking for game state to restore:', {
            hasGameState: !!recoveryData.gameState,
            scenesCount: recoveryData.gameState?.scenes?.length || 0,
          });

          if (
            recoveryData.gameState &&
            recoveryData.gameState.scenes.length > 0
          ) {
            console.log(
              '📂 Restoring game state from localStorage for campaign:',
              {
                scenes: (recoveryData.gameState.scenes as Scene[]).map(
                  (s: Scene) => ({
                    id: s.id,
                    name: s.name,
                    hasBackground: !!s.backgroundImage,
                    tokensCount: s.placedTokens?.length || 0,
                    drawingsCount: s.drawings?.length || 0,
                  }),
                ),
              },
            );

            // Await so the character/initiative stores are hydrated before we
            // re-broadcast the restored state to the server below.
            await get().loadSessionState();

          } else {
            console.log('ℹ️ No game state to restore, starting fresh');
          }

          // Publish an initial authoritative baseline for every room. Fresh
          // rooms need this just as much as restored rooms: without it, the
          // first player joins before the server knows about the default scene
          // and cannot place a token. Restored stores were hydrated above.
          if (webSocketService.isConnected()) {
            console.log('📤 Sending initial game state to server');
            gameStateSyncEngine.schedule();
          }

          // Save session to localStorage for refresh recovery
          // Note: session is already set by the session/created event handler
          saveSessionToStorage(get());

          // Note: Scenes are loaded from PostgreSQL via session/created event.
          // No need to sync from IndexedDB (legacy system) as it would overwrite DB scenes.

          return roomCode;
        } catch (error) {
          console.error('Failed to create room:', error);
          throw error;
        }
      },

      leaveRoom: async () => {
        try {
          const currentState = get();
          console.log('🚪 Leaving room:', {
            roomCode: currentState.session?.roomCode,
            userName: currentState.user.name,
            userType: currentState.user.type,
            isConnected: currentState.user.connected,
          });

          // Import webSocketService
          const { webSocketService } = await import('@/services/websocket');

          // Disconnect WebSocket
          webSocketService.disconnect();

          // Reset the in-memory state
          get().resetToWelcome();

          console.log('✅ Successfully left room and reset to welcome');
        } catch (error) {
          console.error('Failed to leave room:', error);
        }
      },

      /**
       * Reset to welcome screen
       *
       * With URL-based routing, we use window.location to navigate to the
       * dashboard for authenticated users or the lobby for guests.
       */
      resetToWelcome: () => {
        console.log('🔄 Resetting to welcome screen');

        // Save current game state before clearing session
        // This preserves campaign data while clearing reconnection info
        get().saveSessionState();

        const shouldPreserveUser = get().isAuthenticated;

        set((state) => {
          // Clear session data
          state.session = null;
          if (shouldPreserveUser) {
            state.user.connected = false;
          } else {
            state.user = {
              ...initialState.user,
              id: getBrowserId(),
            };
          }
          state.connection = initialState.connection;
        });

        // Clear only the session reconnection data, NOT the game state
        // This prevents auto-reconnect while keeping campaign data saved
        clearSessionFromStorage();
        sessionPersistenceService.clearSession(); // Only clear session, not game state

        // Navigate using window.location for full reset
        window.location.href = shouldPreserveUser ? '/dashboard' : '/lobby';
      },

      // Character Management Actions — extracted to
      // src/stores/game/charactersSlice.ts
      ...createCharactersSlice(get),

      // Note: Lifecycle system removed - use createGameRoom/joinRoomWithCode directly

      leaveGame: () => {
        // Use existing leaveRoom logic
        get().leaveRoom();
        console.log('👋 Left game');
      },

      // Scene Management Actions
      createScene: (sceneData) => {
        const state = get();
        if (!state.session) {
          throw new Error('Cannot create scene: No active session');
        }

        const scene: Scene = {
          ...sceneData,
          id: uuidv4(),
          roomCode: state.session.roomCode, // Auto-inject current room code
          drawings: [], // Initialize with empty drawings array
          placedTokens: [], // Initialize with empty placed tokens array
          placedProps: [], // Initialize with empty placed props array
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => {
          state.sceneState.scenes.push(scene);
          // If this is the first scene, make it active
          if (state.sceneState.activeSceneId === null) {
            state.sceneState.activeSceneId = scene.id;
          }
        });

        // Auto-save the new scene to persistence (serialize to plain object)
        const plainScene = JSON.parse(JSON.stringify(scene));
        drawingPersistenceService.saveScene(plainScene).catch((error) => {
          console.error('Failed to persist new scene:', error);
        });

        // Sync to server for campaign persistence
        get().syncGameStateToServer();

        return scene;
      },

      updateScene: (sceneId, updates) => {
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (sceneIndex >= 0) {
            state.sceneState.scenes[sceneIndex] = {
              ...state.sceneState.scenes[sceneIndex],
              ...updates,
              updatedAt: Date.now(),
            };

            // Auto-save the updated scene to persistence (serialize to plain object)
            const scene = JSON.parse(
              JSON.stringify(state.sceneState.scenes[sceneIndex]),
            );
            drawingPersistenceService.saveScene(scene).catch((error) => {
              console.error('Failed to persist updated scene:', error);
            });
          }
        });

        // Sync to server for campaign persistence
        get().syncGameStateToServer();
      },

      deleteScene: (sceneId) => {
        set((state) => {
          state.sceneState.scenes = state.sceneState.scenes.filter(
            (s) => s.id !== sceneId,
          );
          // If the deleted scene was active, switch to first available scene
          if (state.sceneState.activeSceneId === sceneId) {
            state.sceneState.activeSceneId =
              state.sceneState.scenes.length > 0
                ? state.sceneState.scenes[0].id
                : null;
          }
        });

        // Delete from persistence
        drawingPersistenceService.deleteScene(sceneId).catch((error) => {
          console.error('Failed to persist scene deletion:', error);
        });

        // Sync to server for campaign persistence
        get().syncGameStateToServer();
      },

      reorderScenes: (fromIndex, toIndex) => {
        set((state) => {
          const scenes = [...state.sceneState.scenes];
          const [movedScene] = scenes.splice(fromIndex, 1);
          scenes.splice(toIndex, 0, movedScene);
          state.sceneState.scenes = scenes;
        });
      },

      replaceScenesFromBackup: async (scenes, activeSceneId) => {
        const storage = getLinearFlowStorage();
        await storage.clearGameData();

        set((state) => {
          state.sceneState.scenes = scenes;
          state.sceneState.activeSceneId =
            activeSceneId || scenes[0]?.id || null;
          state.sceneState.camera = { x: 0, y: 0, zoom: 0.54 };
        });

        await Promise.all(
          scenes.map(async (scene) => {
            const plainScene = JSON.parse(JSON.stringify(scene));
            await drawingPersistenceService.saveScene(plainScene);
          }),
        );

        get().syncGameStateToServer();
      },

      setActiveScene: (sceneId) => {
        let sceneChanged = false;
        set((state) => {
          const sceneExists = state.sceneState.scenes.some(
            (s) => s.id === sceneId,
          );
          if (sceneExists && state.sceneState.activeSceneId !== sceneId) {
            state.sceneState.activeSceneId = sceneId;
            sceneChanged = true;
            // Reset camera when switching scenes
            state.sceneState.camera = {
              x: 0,
              y: 0,
              zoom: 0.54,
            };
          }
        });
        if (sceneChanged) get().syncGameStateToServer();
      },

      updateCamera: (cameraUpdates) => {
        set((state) => {
          Object.assign(state.sceneState.camera, cameraUpdates);
        });
      },

      setFollowDM: (follow) => {
        set((state) => {
          state.sceneState.followDM = follow;
        });
      },

      setActiveTool: (tool) => {
        set((state) => {
          state.sceneState.activeTool = tool;
        });
      },

      syncGameStateToServer: () => {
        const state = get();
        if (!state.session || state.user.type !== 'host') {
          // Only host syncs game state to server
          return;
        }

        // Route through the content-hash-chained delta-sync engine. With the
        // delta-sync flag OFF this sends the exact same legacy untagged full
        // snapshot as before; with it ON it sends tagged-full/patch uploads.
        try {
          gameStateSyncEngine.schedule();
        } catch (error) {
          console.error('Failed to sync game state to server:', error);
        }
      },

      // Selection Actions
      setSelection: (objectIds) => {
        console.log('🏪 gameStore.setSelection called with:', objectIds);
        set((state) => {
          const previousSelection = state.sceneState.selectedObjectIds;
          state.sceneState.selectedObjectIds = objectIds;
          console.log('🏪 gameStore.setSelection updated:', {
            previous: previousSelection,
            new: objectIds,
          });
        });
      },

      addToSelection: (objectIds) => {
        set((state) => {
          const newIds = objectIds.filter(
            (id) => !state.sceneState.selectedObjectIds.includes(id),
          );
          if (newIds.length > 0) {
            state.sceneState.selectedObjectIds.push(...newIds);
          }
        });
      },

      removeFromSelection: (objectIds) => {
        set((state) => {
          state.sceneState.selectedObjectIds =
            state.sceneState.selectedObjectIds.filter(
              (id) => !objectIds.includes(id),
            );
        });
      },

      clearSelection: () => {
        set((state) => {
          state.sceneState.selectedObjectIds = [];
        });
      },

      // Bulk Scene Operations
      deleteScenesById: (sceneIds) => {
        set((state) => {
          // Filter out the scenes to delete
          state.sceneState.scenes = state.sceneState.scenes.filter(
            (s) => !sceneIds.includes(s.id),
          );

          // If the active scene was deleted, switch to first available scene
          if (
            state.sceneState.activeSceneId &&
            sceneIds.includes(state.sceneState.activeSceneId)
          ) {
            state.sceneState.activeSceneId =
              state.sceneState.scenes.length > 0
                ? state.sceneState.scenes[0].id
                : null;
          }
        });

        // Delete each scene from persistence
        sceneIds.forEach((sceneId) => {
          drawingPersistenceService.deleteScene(sceneId).catch((error) => {
            console.error('Failed to persist scene deletion:', error);
          });
        });
      },

      updateScenesVisibility: (sceneIds, visibility) => {
        set((state) => {
          sceneIds.forEach((sceneId) => {
            const sceneIndex = state.sceneState.scenes.findIndex(
              (s) => s.id === sceneId,
            );
            if (sceneIndex >= 0) {
              state.sceneState.scenes[sceneIndex].visibility = visibility;
              state.sceneState.scenes[sceneIndex].updatedAt = Date.now();

              // Auto-save the updated scene to persistence (serialize to plain object)
              const scene = JSON.parse(
                JSON.stringify(state.sceneState.scenes[sceneIndex]),
              );
              drawingPersistenceService.saveScene(scene).catch((error) => {
                console.error(
                  'Failed to persist scene visibility update:',
                  error,
                );
              });
            }
          });
        });
      },

      duplicateScene: (sceneId) => {
        const state = get();
        const originalScene = state.sceneState.scenes.find(
          (s) => s.id === sceneId,
        );
        if (!originalScene) return null;

        const duplicatedScene: Scene = {
          ...originalScene,
          id: uuidv4(),
          name: `${originalScene.name} (Copy)`,
          drawings: [...originalScene.drawings], // Deep copy drawings
          placedTokens: [...originalScene.placedTokens], // Deep copy tokens
          placedProps: [...originalScene.placedProps], // Deep copy props
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => {
          state.sceneState.scenes.push(duplicatedScene);
        });

        return duplicatedScene;
      },

      // Drawing Management Actions
      createDrawing: (sceneId, drawing) => {
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (sceneIndex >= 0) {
            state.sceneState.scenes[sceneIndex].drawings.push(drawing);
            state.sceneState.scenes[sceneIndex].updatedAt = Date.now();

            // Auto-save to persistence (serialize to plain object to avoid proxy issues)
            const scene = JSON.parse(
              JSON.stringify(state.sceneState.scenes[sceneIndex]),
            );
            drawingPersistenceService.saveScene(scene).catch((error) => {
              console.error(
                'Failed to persist scene after drawing creation:',
                error,
              );
            });
          }
        });

        scheduleServerSync(get);
      },

      updateDrawing: (sceneId, drawingId, updates) => {
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (sceneIndex >= 0) {
            const drawingIndex = state.sceneState.scenes[
              sceneIndex
            ].drawings.findIndex((d) => d.id === drawingId);
            if (drawingIndex >= 0) {
              const drawingToUpdate = state.sceneState.scenes[sceneIndex]
                .drawings[drawingIndex] as Drawing;
              Object.assign(drawingToUpdate, updates);
              drawingToUpdate.updatedAt = Date.now();
              state.sceneState.scenes[sceneIndex].updatedAt = Date.now();

              // Auto-save to persistence (serialize to plain object)
              const scene = JSON.parse(
                JSON.stringify(state.sceneState.scenes[sceneIndex]),
              );
              drawingPersistenceService.saveScene(scene).catch((error) => {
                console.error(
                  'Failed to persist scene after drawing update:',
                  error,
                );
              });
            }
          }
        });

        scheduleServerSync(get);
      },

      deleteDrawing: (sceneId, drawingId) => {
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (sceneIndex >= 0) {
            state.sceneState.scenes[sceneIndex].drawings =
              state.sceneState.scenes[sceneIndex].drawings.filter(
                (d) => d.id !== drawingId,
              );
            state.sceneState.scenes[sceneIndex].updatedAt = Date.now();

            // Auto-save to persistence (serialize to plain object)
            const scene = JSON.parse(
              JSON.stringify(state.sceneState.scenes[sceneIndex]),
            );
            drawingPersistenceService.saveScene(scene).catch((error) => {
              console.error(
                'Failed to persist scene after drawing deletion:',
                error,
              );
            });
          }
        });

        scheduleServerSync(get);
      },

      clearDrawings: (sceneId, layer) => {
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (sceneIndex >= 0) {
            if (layer) {
              state.sceneState.scenes[sceneIndex].drawings =
                state.sceneState.scenes[sceneIndex].drawings.filter(
                  (d) => d.layer !== layer,
                );
            } else {
              state.sceneState.scenes[sceneIndex].drawings = [];
            }
            state.sceneState.scenes[sceneIndex].updatedAt = Date.now();

            // Auto-save to persistence (serialize to plain object)
            const scene = JSON.parse(
              JSON.stringify(state.sceneState.scenes[sceneIndex]),
            );
            drawingPersistenceService.saveScene(scene).catch((error) => {
              console.error(
                'Failed to persist scene after clearing drawings:',
                error,
              );
            });
          }
        });

        scheduleServerSync(get);
      },

      getSceneDrawings: (sceneId) => {
        const state = get();
        const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
        return scene?.drawings || [];
      },

      getVisibleDrawings: (sceneId, isHost) => {
        const state = get();
        const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
        if (!scene) return [];

        return scene.drawings.filter((drawing) => {
          // DM can see all drawings
          if (isHost) return true;

          // Players can only see drawings visible to them
          if (drawing.layer === 'dm-only') return false;
          if (drawing.style.dmNotesOnly) return false;
          if (drawing.style.visibleToPlayers === false) return false;

          return true;
        });
      },

      // Fog of War Actions (A9): host-authored, unversioned, full-state
      // replace. Each action applies optimistically (mirrors moveTokenOptimistic
      // / token-place: local Immer update first, no rollback/version tracking
      // since these are DM-only relay events, not entity-conflict-prone), then
      // sends the resulting complete SceneFog over the wire so peers can just
      // overwrite their local copy. See fogSlice.ts for the read-side selector.
      setFogEnabled: async (sceneId, enabled) => {
        let nextFog: SceneFog | undefined;
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (sceneIndex < 0) return;
          const existing = state.sceneState.scenes[sceneIndex].fog;
          nextFog = { enabled, shapes: existing?.shapes ?? [] };
          state.sceneState.scenes[sceneIndex].fog = nextFog;
          state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
        });

        if (!nextFog) return;
        scheduleServerSync(get);
        const { webSocketService } = await import('@/services/websocket');
        webSocketService.sendEvent({
          type: 'fog/update',
          data: { sceneId, fog: nextFog },
        });
      },

      addFogShape: async (sceneId, shape) => {
        let nextFog: SceneFog | undefined;
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (sceneIndex < 0) return;
          const existing = state.sceneState.scenes[sceneIndex].fog;
          nextFog = {
            enabled: existing?.enabled ?? true,
            shapes: [...(existing?.shapes ?? []), shape],
          };
          state.sceneState.scenes[sceneIndex].fog = nextFog;
          state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
        });

        if (!nextFog) return;
        scheduleServerSync(get);
        const { webSocketService } = await import('@/services/websocket');
        webSocketService.sendEvent({
          type: 'fog/update',
          data: { sceneId, fog: nextFog },
        });
      },

      clearFog: async (sceneId) => {
        let didClearFog = false;
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (sceneIndex < 0) return;
          const existing = state.sceneState.scenes[sceneIndex].fog;
          state.sceneState.scenes[sceneIndex].fog = {
            enabled: existing?.enabled ?? false,
            shapes: [],
          };
          state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
          didClearFog = true;
        });

        if (!didClearFog) return;
        scheduleServerSync(get);
        const { webSocketService } = await import('@/services/websocket');
        webSocketService.sendEvent({
          type: 'fog/clear',
          data: { sceneId },
        });
      },

      // Settings Management Actions — extracted to
      // src/stores/game/settingsSlice.ts
      ...createSettingsSlice(set, get),

      // Token Management Actions
      placeToken: (sceneId, token) => {
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (sceneIndex >= 0) {
            if (!state.sceneState.scenes[sceneIndex].placedTokens) {
              state.sceneState.scenes[sceneIndex].placedTokens = [];
            }
            state.sceneState.scenes[sceneIndex].placedTokens.push(token);
            state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
          }
        });

        scheduleCampaignPersistence(sceneId, get);
      },

      moveToken: (sceneId, tokenId, position, rotation) => {
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (
            sceneIndex >= 0 &&
            state.sceneState.scenes[sceneIndex].placedTokens
          ) {
            const tokenIndex = state.sceneState.scenes[
              sceneIndex
            ].placedTokens.findIndex((t) => t.id === tokenId);
            if (tokenIndex >= 0) {
              state.sceneState.scenes[sceneIndex].placedTokens[tokenIndex].x =
                position.x;
              state.sceneState.scenes[sceneIndex].placedTokens[tokenIndex].y =
                position.y;
              if (rotation !== undefined) {
                state.sceneState.scenes[sceneIndex].placedTokens[
                  tokenIndex
                ].rotation = rotation;
              }
              state.sceneState.scenes[sceneIndex].placedTokens[
                tokenIndex
              ].updatedAt = Date.now();
              state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
            }
          }
        });

        scheduleCampaignPersistence(sceneId, get);
      },

      updateToken: (sceneId, tokenId, updates) => {
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (
            sceneIndex >= 0 &&
            state.sceneState.scenes[sceneIndex].placedTokens
          ) {
            const tokenIndex = state.sceneState.scenes[
              sceneIndex
            ].placedTokens.findIndex((t) => t.id === tokenId);
            if (tokenIndex >= 0) {
              const tokenToUpdate =
                state.sceneState.scenes[sceneIndex].placedTokens[tokenIndex];
              Object.assign(tokenToUpdate, updates);
              tokenToUpdate.updatedAt = Date.now();
              state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
            }
          }
        });

        scheduleCampaignPersistence(sceneId, get);
      },

      deleteToken: (sceneId, tokenId) => {
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (
            sceneIndex >= 0 &&
            state.sceneState.scenes[sceneIndex].placedTokens
          ) {
            state.sceneState.scenes[sceneIndex].placedTokens =
              state.sceneState.scenes[sceneIndex].placedTokens.filter(
                (t) => t.id !== tokenId,
              );
            state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
          }
        });

        // Clear selection if this token was selected
        const state = get();
        if (state.sceneState.selectedObjectIds.includes(tokenId)) {
          get().clearSelection();
        }

        // Broadcast deletion via WebSocket
        (async () => {
          const { webSocketService } = await import('@/services/websocket');
          webSocketService.sendEvent({
            type: 'token/delete',
            data: {
              sceneId,
              tokenId,
            },
          });
        })();

        scheduleCampaignPersistence(sceneId, get);
      },

      getSceneTokens: (sceneId) => {
        const state = get();
        const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
        return scene?.placedTokens || [];
      },

      getVisibleTokens: (sceneId, isHost) => {
        const state = get();
        const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
        if (!scene) return [];

        return scene.placedTokens.filter((token) => {
          // DM can see all tokens
          if (isHost) return true;

          // Players can only see visible tokens
          if (!token.visibleToPlayers) return false;

          return true;
        });
      },

      autoPlaceCharacterToken: async (characterId, sceneId) => {
        const { user, session, sceneState } = get();
        const { useCharacterStore } = await import('@/stores/characterStore');
        const character = useCharacterStore
          .getState()
          .getCharacter(characterId);

        if (!character || !session) {
          console.log('🎭 Cannot auto-place: missing character or session');
          return;
        }

        const scene = sceneState.scenes.find((s) => s.id === sceneId);
        if (!scene) {
          console.log('🎭 Cannot auto-place: scene not found');
          return;
        }

        // Check if token already exists for this character (de-dupe)
        const existingToken = scene.placedTokens?.find(
          (t) => t.characterId === characterId,
        );
        if (existingToken) {
          console.log('🎭 Token already exists for character:', character.name);
          return;
        }

        // Spawn point (center or defined spawn)
        const spawnPoint = {
          x: (scene.backgroundImage?.width || 1000) / 2,
          y: (scene.backgroundImage?.height || 1000) / 2,
        };

        // Get default token
        const { tokenAssetManager } = await import('@/services/tokenAssets');
        const tokenTemplate =
          await tokenAssetManager.getDefaultTokenForCharacter(character);

        // Create placed token with character binding
        const { createPlacedToken } = await import('@/types/token');
        const placedToken = createPlacedToken(
          tokenTemplate,
          spawnPoint,
          sceneId,
          session.roomCode,
          user.id,
          {
            nameOverride: character.name,
            characterId: character.id,
            currentStats: {
              hp: character.hitPoints,
              ac: character.armorClass,
            },
            visibleToPlayers: true,
          },
        );

        // Place token (synchronously updates state)
        get().placeToken(sceneId, placedToken);

        // Broadcast binding event (so peers can link if they have character)
        const { webSocketService } = await import('@/services/websocket');
        webSocketService.sendEvent({
          type: 'event',
          data: {
            name: 'character/bind-to-token',
            sourceClientId: user.id,
            characterId: character.id,
            tokenId: placedToken.id,
            sceneId,
          },
        });

        console.log('🎭 Auto-placed token for character:', character.name);
      },

      autoPlacePlayerToken: async (playerName, imageUrl, sceneIdOverride) => {
        const { user, session, sceneState } = get();

        if (!session) {
          console.log('🎭 Cannot auto-place: missing session');
          return;
        }

        const sceneId = sceneIdOverride || sceneState.activeSceneId;
        if (!sceneId) {
          console.log('🎭 Cannot auto-place: missing active scene');
          return;
        }

        const scene = sceneState.scenes.find((s) => s.id === sceneId);
        if (!scene) {
          console.log('🎭 Cannot auto-place: scene not found');
          return;
        }

        const existingToken = scene.placedTokens?.find(
          (token) =>
            token.placedBy === user.id &&
            token.nameOverride?.toLowerCase() === playerName.toLowerCase(),
        );
        if (existingToken) {
          console.log('🎭 Token already exists for player:', playerName);
          return;
        }

        const spawnPoint = {
          x: (scene.backgroundImage?.width || 1000) / 2,
          y: (scene.backgroundImage?.height || 1000) / 2,
        };

        const { tokenAssetManager } = await import('@/services/tokenAssets');
        await tokenAssetManager.initialize();

        const tokenImage =
          imageUrl || tokenAssetManager.createPlaceholderTokenImage(playerName);

        const { createToken, createPlacedToken } =
          await import('@/types/token');
        const baseToken = createToken({
          name: playerName,
          image: tokenImage,
          thumbnailImage: tokenImage,
          size: 'medium',
          category: 'pc',
          tags: ['player'],
          isCustom: true,
        });

        const libraries = tokenAssetManager.getLibraries();
        let targetLibrary = libraries.find(
          (lib) => lib.name === 'Custom Tokens',
        );
        if (!targetLibrary) {
          targetLibrary = tokenAssetManager.createCustomLibrary(
            'Custom Tokens',
            'User-created custom tokens',
          );
        }

        const token = tokenAssetManager.addCustomTokenWithId(
          targetLibrary.id,
          baseToken,
        );

        const placedToken = createPlacedToken(
          token,
          spawnPoint,
          sceneId,
          session.roomCode,
          user.id,
          {
            nameOverride: playerName,
            visibleToPlayers: true,
          },
        );

        get().placeToken(sceneId, placedToken);

        const { webSocketService } = await import('@/services/websocket');
        webSocketService.sendEvent({
          type: 'token/add-custom',
          data: { token },
        });

        webSocketService.sendEvent({
          type: 'token/place',
          data: {
            sceneId,
            token: placedToken,
          },
        });

        console.log('🎭 Auto-placed token for player:', playerName);
      },

      // Optimistic Update Actions
      moveTokenOptimistic: (sceneId, tokenId, position, rotation) => {
        const updateId = `token-move-${tokenId}-${Date.now()}`;

        // Store current state for potential rollback
        const token = get()
          .getSceneTokens(sceneId)
          .find((t) => t.id === tokenId);
        if (!token) return;

        // Get the expected version BEFORE incrementing
        const expectedVersion = get().getEntityVersion(tokenId);

        // Store the pending update for rollback capability (including the version)
        pendingUpdates.set(updateId, {
          id: updateId,
          type: 'token-move',
          localState: { ...token, sceneId },
          timestamp: Date.now(),
          previousVersion: expectedVersion, // Store for rollback
        });

        // Update optimistically
        get().moveToken(sceneId, tokenId, position, rotation);

        // Increment the local version immediately to prevent version conflicts on rapid updates
        get().incrementEntityVersion(tokenId);

        // Send to server with updateId and version for tracking
        import('@/services/websocket').then(({ webSocketService }) => {
          webSocketService.sendEvent({
            type: 'token/move',
            data: {
              sceneId,
              tokenId,
              position,
              rotation,
              updateId,
              expectedVersion,
            },
          });
        });

        // Set timeout for automatic rollback if no confirmation (5 seconds)
        setTimeout(() => {
          if (pendingUpdates.has(updateId)) {
            console.warn('Server confirmation timeout, rolling back', updateId);
            get().rollbackUpdate(updateId);
          }
        }, 5000);
      },

      confirmUpdate: (updateId) => {
        // Remove from pending updates
        pendingUpdates.delete(updateId);
        console.log('✅ Update confirmed:', updateId);
      },

      rollbackUpdate: (updateId) => {
        const update = pendingUpdates.get(updateId);
        if (!update) return;

        console.warn('❌ Rolling back update:', updateId);

        // Restore previous state based on update type
        switch (update.type) {
          case 'token-move':
            // Restore the token to its previous position
            get().moveToken(
              (update.localState as PlacedToken).sceneId || '', // Need to store sceneId in localState
              update.localState.id,
              { x: update.localState.x, y: update.localState.y },
              (update.localState as PlacedToken).rotation,
            );

            // Restore the previous version
            if (update.previousVersion !== undefined) {
              set((state) => {
                state.entityVersions.set(
                  update.localState.id,
                  update.previousVersion!,
                );
              });
            }
            break;
          case 'prop-move':
            // Restore the prop to its previous position
            get().moveProp(
              (update.localState as PlacedProp).sceneId || '',
              update.localState.id,
              { x: update.localState.x, y: update.localState.y },
              (update.localState as PlacedProp).rotation,
            );

            // Restore the previous version
            if (update.previousVersion !== undefined) {
              set((state) => {
                state.entityVersions.set(
                  update.localState.id,
                  update.previousVersion!,
                );
              });
            }
            break;
          case 'prop-update':
            // Restore the prop to its previous state
            get().updateProp(
              (update.localState as PlacedProp).sceneId || '',
              update.localState.id,
              update.localState as PlacedProp,
            );

            // Restore the previous version
            if (update.previousVersion !== undefined) {
              set((state) => {
                state.entityVersions.set(
                  update.localState.id,
                  update.previousVersion!,
                );
              });
            }
            break;
        }

        pendingUpdates.delete(updateId);
      },

      // Prop Management Actions
      placeProp: (sceneId, prop) => {
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (sceneIndex >= 0) {
            if (!state.sceneState.scenes[sceneIndex].placedProps) {
              state.sceneState.scenes[sceneIndex].placedProps = [];
            }
            state.sceneState.scenes[sceneIndex].placedProps.push(prop);
            state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
          }
        });

        scheduleCampaignPersistence(sceneId, get);
      },

      moveProp: (sceneId, propId, position, rotation) => {
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (
            sceneIndex >= 0 &&
            state.sceneState.scenes[sceneIndex].placedProps
          ) {
            const propIndex = state.sceneState.scenes[
              sceneIndex
            ].placedProps.findIndex((p) => p.id === propId);
            if (propIndex >= 0) {
              state.sceneState.scenes[sceneIndex].placedProps[propIndex].x =
                position.x;
              state.sceneState.scenes[sceneIndex].placedProps[propIndex].y =
                position.y;
              if (rotation !== undefined) {
                state.sceneState.scenes[sceneIndex].placedProps[
                  propIndex
                ].rotation = rotation;
              }
              state.sceneState.scenes[sceneIndex].placedProps[
                propIndex
              ].updatedAt = Date.now();
              state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
            }
          }
        });

        scheduleCampaignPersistence(sceneId, get);
      },

      updateProp: (sceneId, propId, updates) => {
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (
            sceneIndex >= 0 &&
            state.sceneState.scenes[sceneIndex].placedProps
          ) {
            const propIndex = state.sceneState.scenes[
              sceneIndex
            ].placedProps.findIndex((p) => p.id === propId);
            if (propIndex >= 0) {
              const propToUpdate =
                state.sceneState.scenes[sceneIndex].placedProps[propIndex];
              Object.assign(propToUpdate, updates);
              propToUpdate.updatedAt = Date.now();
              state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
            }
          }
        });

        scheduleCampaignPersistence(sceneId, get);
      },

      deleteProp: (sceneId, propId) => {
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (
            sceneIndex >= 0 &&
            state.sceneState.scenes[sceneIndex].placedProps
          ) {
            state.sceneState.scenes[sceneIndex].placedProps =
              state.sceneState.scenes[sceneIndex].placedProps.filter(
                (p) => p.id !== propId,
              );
            state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
          }
        });

        scheduleCampaignPersistence(sceneId, get);
      },

      interactWithProp: (sceneId, propId, action) => {
        set((state) => {
          const sceneIndex = state.sceneState.scenes.findIndex(
            (s) => s.id === sceneId,
          );
          if (
            sceneIndex >= 0 &&
            state.sceneState.scenes[sceneIndex].placedProps
          ) {
            const propIndex = state.sceneState.scenes[
              sceneIndex
            ].placedProps.findIndex((p) => p.id === propId);
            if (propIndex >= 0) {
              const prop =
                state.sceneState.scenes[sceneIndex].placedProps[propIndex];

              // Update prop state based on action
              if (!prop.currentStats) prop.currentStats = {};

              switch (action) {
                case 'open':
                  prop.currentStats = { ...prop.currentStats, state: 'open' };
                  break;
                case 'close':
                  prop.currentStats = { ...prop.currentStats, state: 'closed' };
                  break;
                case 'lock':
                  prop.currentStats = { ...prop.currentStats, state: 'locked' };
                  if (prop.currentStats) prop.currentStats.locked = true;
                  break;
                case 'unlock':
                  prop.currentStats = { ...prop.currentStats, state: 'closed' };
                  if (prop.currentStats) prop.currentStats.locked = false;
                  break;
              }

              prop.updatedAt = Date.now();
              state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
            }
          }
        });

        // Send to server
        import('@/services/websocket').then(({ webSocketService }) => {
          webSocketService.sendEvent({
            type: 'prop/interact',
            data: {
              sceneId,
              propId,
              action,
              expectedVersion: get().getEntityVersion(propId),
            },
          });
        });
      },

      getSceneProps: (sceneId) => {
        const state = get();
        const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
        return scene?.placedProps || [];
      },

      getVisibleProps: (sceneId, isHost) => {
        const state = get();
        const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
        if (!scene) return [];

        return scene.placedProps.filter((prop) => {
          // DM can see all props
          if (isHost) return true;

          // Players can only see visible props
          if (!prop.visibleToPlayers) return false;
          if (prop.dmNotesOnly) return false;

          return true;
        });
      },

      getPlacedPropById: (sceneId, propId) => {
        const state = get();
        const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
        return scene?.placedProps.find((p) => p.id === propId);
      },

      // Prop Optimistic Update Actions
      movePropOptimistic: (sceneId, propId, position, rotation) => {
        const updateId = `prop-move-${propId}-${Date.now()}`;

        // Store current state for potential rollback
        const prop = get()
          .getSceneProps(sceneId)
          .find((p) => p.id === propId);
        if (!prop) return;

        // Get the expected version BEFORE incrementing
        const expectedVersion = get().getEntityVersion(propId);

        // Store the pending update for rollback capability (including the version)
        pendingUpdates.set(updateId, {
          id: updateId,
          type: 'prop-move',
          localState: { ...prop, sceneId },
          timestamp: Date.now(),
          previousVersion: expectedVersion,
        });

        // Update optimistically
        get().moveProp(sceneId, propId, position, rotation);

        // Increment the local version immediately to prevent version conflicts on rapid updates
        get().incrementEntityVersion(propId);

        // Send to server with updateId and version for tracking
        import('@/services/websocket').then(({ webSocketService }) => {
          webSocketService.sendEvent({
            type: 'prop/move',
            data: {
              sceneId,
              propId,
              position,
              rotation,
              updateId,
              expectedVersion,
            },
          });
        });

        // Set timeout for automatic rollback if no confirmation (5 seconds)
        setTimeout(() => {
          if (pendingUpdates.has(updateId)) {
            console.warn('Server confirmation timeout, rolling back', updateId);
            get().rollbackUpdate(updateId);
          }
        }, 5000);
      },

      updatePropOptimistic: (sceneId, propId, updates) => {
        const updateId = `prop-update-${propId}-${Date.now()}`;

        // Store current state for potential rollback
        const prop = get()
          .getSceneProps(sceneId)
          .find((p) => p.id === propId);
        if (!prop) return;

        // Get the expected version BEFORE incrementing
        const expectedVersion = get().getEntityVersion(propId);

        // Store the pending update for rollback capability
        pendingUpdates.set(updateId, {
          id: updateId,
          type: 'prop-update',
          localState: { ...prop, sceneId },
          timestamp: Date.now(),
          previousVersion: expectedVersion,
        });

        // Update optimistically
        get().updateProp(sceneId, propId, updates);

        // Increment the local version immediately
        get().incrementEntityVersion(propId);

        // Send to server with updateId and version for tracking
        import('@/services/websocket').then(({ webSocketService }) => {
          webSocketService.sendEvent({
            type: 'prop/update',
            data: {
              sceneId,
              propId,
              updates,
              updateId,
              expectedVersion,
            },
          });
        });

        // Set timeout for automatic rollback if no confirmation (5 seconds)
        setTimeout(() => {
          if (pendingUpdates.has(updateId)) {
            console.warn('Server confirmation timeout, rolling back', updateId);
            get().rollbackUpdate(updateId);
          }
        }, 5000);
      },

      // Persistence Management Actions
      initializeFromStorage: async (roomCode?: string) => {
        try {
          const savedScenes =
            await drawingPersistenceService.loadAllScenes(roomCode);

          if (savedScenes.length > 0) {
            set((state) => {
              state.sceneState.scenes = savedScenes;
              // Set the first scene as active if no active scene is set
              if (!state.sceneState.activeSceneId && savedScenes.length > 0) {
                state.sceneState.activeSceneId = savedScenes[0].id;
              }
            });
            console.log(
              `Initialized ${savedScenes.length} scenes from storage`,
            );
          }
        } catch (error) {
          console.error('Failed to initialize from storage:', error);
        }
      },

      loadSceneDrawings: async (sceneId) => {
        try {
          const roomCode = get().session?.roomCode;
          const drawings = await drawingPersistenceService.loadDrawings(
            sceneId,
            roomCode,
          );

          set((state) => {
            const sceneIndex = state.sceneState.scenes.findIndex(
              (s) => s.id === sceneId,
            );
            if (sceneIndex >= 0) {
              state.sceneState.scenes[sceneIndex].drawings = drawings;
              state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
            }
          });

          console.log(
            `Loaded ${drawings.length} drawings for scene ${sceneId}`,
          );
        } catch (error) {
          console.error('Failed to load scene drawings:', error);
        }
      },

      // Session Persistence Actions
      saveSessionState: () => {
        const state = get();

        console.log('💾 saveSessionState called', {
          hasSession: !!state.session,
          roomCode: state.session?.roomCode,
          scenesCount: state.sceneState.scenes.length,
          activeSceneId: state.sceneState.activeSceneId,
        });

        // Skip saves when there is no active session or no scenes loaded to avoid wiping state
        if (!state.session) {
          console.warn('⚠️ Skipping saveSessionState: no active session');
          return;
        }

        if (!state.sceneState.scenes || state.sceneState.scenes.length === 0) {
          console.warn('⚠️ Skipping saveSessionState: no scenes in state');
          return;
        }

        // Save session data if connected
        sessionPersistenceService.saveSession({
          roomCode: state.session.roomCode,
          userId: state.user.id,
          userType: state.user.type,
          userName: state.user.name,
          hostId: state.session.hostId,
          lastActivity: Date.now(),
          sessionVersion: 1,
        });

        // Save game state (characters, scenes, settings, etc.)
        // Strip out large data (background images) that are already in IndexedDB
        // to avoid localStorage quota issues
        const scenesForLocalStorage = state.sceneState.scenes.map((scene) => ({
          ...scene,
          // Preserve background images to avoid breaking reloads; if this becomes too large,
          // consider streaming to IndexedDB with a lookup key instead of placeholder.
        }));

        // Pull live data from the character and initiative stores so player
        // characters and combat state survive refresh and round-trip through
        // server persistence. characterStore does not self-persist, so this
        // snapshot is the only path by which characters are recovered.
        const characters: Character[] = useCharacterStore.getState().characters;
        const initiativeSnapshot = buildInitiativeSnapshot();

        const gameStateData = {
          characters,
          initiative: initiativeSnapshot,
          scenes: scenesForLocalStorage,
          activeSceneId: state.sceneState.activeSceneId,
          settings: state.settings,
        };

        // Log what we're about to save
        console.log('💾 Saving game state:', {
          scenesCount: gameStateData.scenes.length,
          scenes: gameStateData.scenes.map((s) => ({
            id: s.id,
            name: s.name,
            hasBackground: !!s.backgroundImage,
            tokensCount: s.placedTokens?.length || 0,
            drawingsCount: s.drawings?.length || 0,
          })),
        });

        // Save to IndexedDB (async, but we don't await to avoid blocking)
        sessionPersistenceService
          .saveGameState(gameStateData)
          .catch((error) => {
            console.error('Failed to save game state:', error);
          });

        // Also send game state to server if connected and user is host.
        // Routes through the delta-sync engine: flag OFF → byte-identical legacy
        // full snapshot (the engine's sendLegacy calls sendGameStateUpdate with
        // the same live scenes/characters/initiative); flag ON → tagged upload.
        if (
          state.user.type === 'host' &&
          state.user.connected &&
          state.session
        ) {
          try {
            gameStateSyncEngine.schedule();
          } catch (error) {
            console.error('Failed to send game state update:', error);
          }
        }
      },

      loadSessionState: async () => {
        const recoveryData = await sessionPersistenceService.getRecoveryData();

        if (recoveryData.gameState) {
          set((state) => {
            // Restore scenes and active scene (always restore, even if empty)
            if (recoveryData.gameState) {
              state.sceneState.scenes = (recoveryData.gameState.scenes ||
                []) as Scene[];
              state.sceneState.activeSceneId =
                recoveryData.gameState.activeSceneId;
              console.log(
                `🔄 Restored ${state.sceneState.scenes.length} scenes, activeSceneId: ${state.sceneState.activeSceneId}`,
              );
            }

            // Restore settings
            if (recoveryData.gameState && recoveryData.gameState.settings) {
              state.settings = {
                ...state.settings,
                ...recoveryData.gameState.settings,
              };
            }
          });

          // Restore characters and initiative into their own stores. These are
          // serialized in saveSessionState; characterStore does not self-persist,
          // so this is the only path that recovers characters after a refresh.
          const persistedGameState = recoveryData.gameState;

          const persistedCharacters = persistedGameState.characters;
          if (
            Array.isArray(persistedCharacters) &&
            persistedCharacters.length > 0
          ) {
            useCharacterStore.setState({
              characters: persistedCharacters as Character[],
            });
            console.log(
              `🔄 Restored ${persistedCharacters.length} characters from session state`,
            );
          }

          const persistedInitiative = persistedGameState.initiative;
          if (
            persistedInitiative &&
            typeof persistedInitiative === 'object' &&
            !Array.isArray(persistedInitiative)
          ) {
            const initiativeState =
              persistedInitiative as Partial<InitiativeState>;
            // Shallow-merge so the store's action methods are preserved while
            // combat state fields are overwritten with the persisted snapshot.
            useInitiativeStore.setState(initiativeState);
            console.log(
              `🔄 Restored initiative: ${initiativeState.entries?.length ?? 0} entries, round ${initiativeState.round ?? 0}`,
            );
          }

          console.log('📂 Game state restored from localStorage');
        }
      },

      attemptSessionRecovery: async () => {
        console.log('🔄 Attempting session recovery...');

        // Set recovery flag to prevent auto-saving during recovery
        set((state) => {
          state.isRecovering = true;
        });

        try {
          // First check what's in localStorage for debugging
          const sessionData = localStorage.getItem('nexus-session');
          const gameStateData = localStorage.getItem('nexus-game-state');
          const activeSessionData = localStorage.getItem(
            'nexus-active-session',
          );
          console.log('🔍 Raw localStorage data:');
          console.log(
            '  Session:',
            sessionData ? JSON.parse(sessionData) : 'null',
          );
          console.log('  Game State:', gameStateData ? 'exists' : 'null');
          console.log(
            '  Active Session:',
            activeSessionData ? JSON.parse(activeSessionData) : 'null',
          );

          let recoveryData = await sessionPersistenceService.getRecoveryData();
          console.log('🔍 Processed recovery data:', recoveryData);

          // If no recovery data from sessionPersistenceService, try nexus-active-session
          if (!recoveryData.isValid && activeSessionData) {
            try {
              const activeSession = JSON.parse(activeSessionData);
              console.log(
                '🔄 Falling back to nexus-active-session data:',
                activeSession,
              );

              // Create a minimal recovery data structure from active session
              recoveryData = {
                session: {
                  roomCode: activeSession.roomCode,
                  userId: activeSession.userId || getBrowserId(), // Use stored userId to preserve host identity
                  userType: activeSession.userType,
                  userName: activeSession.userName,
                  lastActivity: activeSession.timestamp,
                  sessionVersion: 1,
                },
                gameState: null, // No game state in active session
                isValid: true,
                canReconnect: true,
              };
              console.log('✅ Created recovery data from active session');
            } catch (parseError) {
              console.error('Failed to parse active session data:', parseError);
            }
          }
          if (recoveryData.gameState) {
            console.log('🎮 Game state details:', {
              scenes: recoveryData.gameState.scenes,
              activeSceneId: recoveryData.gameState.activeSceneId,
              scenesLength: recoveryData.gameState.scenes?.length || 0,
            });
          }

          if (!recoveryData.isValid || !recoveryData.session) {
            console.log('❌ No valid session found for recovery');
            return false;
          }

          if (!recoveryData.canReconnect) {
            console.log('❌ Session too old or invalid for reconnection');
            const sessionAge = Date.now() - recoveryData.session.lastActivity;
            console.log(
              `   Session age: ${Math.round(sessionAge / 1000)}s (max: ${60 * 60}s)`,
            );
            sessionPersistenceService.clearAll();
            return false;
          }

          console.log(
            `🏠 Attempting to reconnect to room ${recoveryData.session.roomCode} as ${recoveryData.session.userType}`,
          );

          // Load game state first
          if (recoveryData.gameState) {
            console.log('🎮 Restoring game state from localStorage');
            get().loadSessionState();
          }

          // Restore user information from persisted session
          set((state) => {
            state.user = {
              ...state.user,
              id: recoveryData.session!.userId,
              name: recoveryData.session!.userName,
              type: recoveryData.session!.userType,
              connected: false, // Will be set to true when WebSocket connects
            };
          });

          // Import webSocketService here to avoid circular dependencies
          const { webSocketService } = await import('@/services/websocket');

          // Attempt to reconnect to the WebSocket session
          console.log(
            `🔌 Connecting WebSocket: roomCode=${recoveryData.session.roomCode}, userType=${recoveryData.session.userType}`,
          );

          // Start listening for the server's verdict before connecting so a
          // confirmation can't slip past between socket-open and listener
          // setup. Rejection is handled below; the no-op catch silences the
          // unhandled-rejection warning if connect() itself throws first.
          const sessionConfirmed = webSocketService.waitForSessionConfirmed();
          sessionConfirmed.catch(() => {});

          // Pass the userType to determine if this is a host reconnection or player join
          await webSocketService.connect(
            recoveryData.session.roomCode,
            recoveryData.session.userType,
            get().gameConfig?.campaignId,
            recoveryData.session.userId,
            recoveryData.session.userName,
          );

          // The socket opening only proves the server is up — the room may
          // have been dropped (hibernation/abandonment/restart). Without this
          // wait, recovery "succeeds" for a dead room and the app hangs on the
          // loading screen while the stored cookie keeps recreating the loop.
          try {
            await sessionConfirmed;
          } catch (confirmError) {
            console.warn(
              '❌ Server did not confirm the session — clearing dead recovery state:',
              confirmError,
            );
            webSocketService.disconnect();
            get().resetSessionForExpiredRoom();
            // A 'Room not found' server error already raised its own toast in
            // the websocket handler; only announce the silent-timeout case.
            if (
              confirmError instanceof Error &&
              confirmError.message.includes('timeout')
            ) {
              const { toast } = await import('@/utils/notifications');
              toast.error('Session Expired', {
                description: 'Your previous session has ended.',
              });
            }
            return false;
          }

          // If we're the host and have game state, send it to the server.
          // loadSessionState() above already rehydrated the character/initiative
          // stores and scenes, so the delta-sync engine rebuilds the same
          // snapshot from live state. Flag OFF → byte-identical legacy full send.
          if (
            recoveryData.session.userType === 'host' &&
            recoveryData.gameState &&
            recoveryData.gameState.scenes.length > 0
          ) {
            console.log('📤 Sending restored game state to server');
            gameStateSyncEngine.schedule();
          }

          console.log(
            `✅ Session recovery successful for room ${recoveryData.session.roomCode}`,
          );
          console.log(
            `🎮 Current game state after recovery:`,
            get().sceneState,
          );

          return true;
        } catch (error) {
          console.error('❌ Session recovery failed:', error);

          // Only clear session data if WebSocket connection failed
          // Keep local state in case user wants to try manual reconnection
          if (error instanceof Error && error.message.includes('WebSocket')) {
            console.log(
              '🔄 WebSocket reconnection failed, but keeping local session data',
            );
          } else {
            sessionPersistenceService.clearAll();
          }

          return false;
        } finally {
          // Always clear the flag here: the early `return false` paths above
          // used to leave isRecovering=true forever, so ProtectedRoute never
          // reached its redirect-to-lobby branch and the app hung on the
          // loading screen.
          set((state) => {
            state.isRecovering = false;
          });
        }
      },

      clearSessionData: () => {
        sessionPersistenceService.clearAll();
        console.log('🗑️ All session data cleared');
      },

      // Developer Actions — extracted to src/stores/game/devSlice.ts
      ...createDevSlice(set, get),

      // Chat Actions — extracted to src/stores/game/chatSlice.ts
      ...createChatSlice(set, get),

      // Voice Actions — extracted to src/stores/game/voiceSlice.ts
      ...createVoiceSlice(set),

      // Connection Actions
      updateConnectionState: (updates) => {
        set((state) => {
          Object.assign(state.connection, updates);
        });
      },

      setConnectionQuality: (quality, latency) => {
        set((state) => {
          state.connection.quality = quality;
          if (latency !== undefined) {
            state.connection.latency = latency;
          }
          state.connection.lastUpdate = Date.now();
        });
      },

      // Version Management Actions
      getEntityVersion: (entityId) => {
        const state = get();
        return state.entityVersions.get(entityId) || 0;
      },

      incrementEntityVersion: (entityId) => {
        const currentVersion = get().getEntityVersion(entityId);
        const newVersion = currentVersion + 1;
        set((state) => {
          state.entityVersions.set(entityId, newVersion);
        });
        return newVersion;
      },

      // Host Management Actions
      transferHost: (targetUserId) => {
        const state = get();
        if (state.user.type !== 'host' || !state.session) {
          console.warn('Only the current host can transfer host privileges');
          return;
        }

        import('@/services/websocket').then(({ webSocketService }) => {
          webSocketService.sendEvent({
            type: 'host/transfer',
            data: { targetUserId },
          });
        });
      },

      addCoHost: (targetUserId) => {
        const state = get();
        if (state.user.type !== 'host' || !state.session) {
          console.warn('Only the current host can add co-hosts');
          return;
        }

        import('@/services/websocket').then(({ webSocketService }) => {
          webSocketService.sendEvent({
            type: 'host/add-cohost',
            data: { targetUserId },
          });
        });
      },

      removeCoHost: (targetUserId) => {
        const state = get();
        if (state.user.type !== 'host' || !state.session) {
          console.warn('Only the current host can remove co-hosts');
          return;
        }

        import('@/services/websocket').then(({ webSocketService }) => {
          webSocketService.sendEvent({
            type: 'host/remove-cohost',
            data: { targetUserId },
          });
        });
      },
    };
  }),
);

configureGameStoreContext(() => {
  const state = useGameStore.getState();
  return {
    userId: state.user.id,
    isAuthenticated: state.isAuthenticated,
  };
});

// Selectors for common queries
export const useUser = () => useGameStore((state) => state.user);
export const useSession = () => useGameStore((state) => state.session);
export const useDiceRolls = () => useGameStore((state) => state.diceRolls);
export const useActiveTab = () => useGameStore((state) => state.activeTab);
export const useIsHost = () =>
  useGameStore((state) => state.user.type === 'host');
export const useIsConnected = () =>
  useGameStore((state) => state.user.connected);

// Scene selectors
export const useSceneState = () => useGameStore((state) => state.sceneState);
export const useScenes = () => useGameStore((state) => state.sceneState.scenes);
export const useActiveScene = () =>
  useGameStore((state) => {
    const { scenes, activeSceneId } = state.sceneState;
    return scenes.find((s) => s.id === activeSceneId) || null;
  });
export const useCamera = () => useGameStore((state) => state.sceneState.camera);
export const useFollowDM = () =>
  useGameStore((state) => state.sceneState.followDM);
export const useActiveTool = () =>
  useGameStore((state) => state.sceneState.activeTool);

// Settings selectors
export const useSettings = () => useGameStore((state) => state.settings);
export const useColorScheme = () =>
  useGameStore((state) => state.settings.colorScheme);
export const useTheme = () => useGameStore((state) => state.settings.theme);

// Stable empty fallbacks: a selector must never return a FRESH `[]` per
// snapshot read — useSyncExternalStore treats an always-new reference as a
// changed snapshot and re-renders in a loop ("The result of getSnapshot
// should be cached"), which presents as an intermittent UI hang (seen when a
// scene id is transiently missing during join/scene-switch). Same class of
// bug the A5 slices fixed with EMPTY_* constants; filter-based selectors get
// useShallow instead (elements keep identity, so shallow compare is stable).
const STABLE_EMPTY_DRAWINGS: Drawing[] = [];
const STABLE_EMPTY_TOKENS: PlacedToken[] = [];
const STABLE_EMPTY_PROPS: PlacedProp[] = [];

// Drawing selectors
export const useSceneDrawings = (sceneId: string) =>
  useGameStore((state) => {
    const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
    return scene?.drawings || STABLE_EMPTY_DRAWINGS;
  });

export const useVisibleDrawings = (sceneId: string) =>
  useGameStore(
    useShallow((state) => {
      const isHost = state.user.type === 'host';
      return state.getVisibleDrawings(sceneId, isHost);
    }),
  );

// Token selectors
export const usePlacedTokens = (sceneId: string) =>
  useGameStore((state) => {
    const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
    return scene?.placedTokens || STABLE_EMPTY_TOKENS;
  });

// Prop selectors
export const usePlacedProps = (sceneId: string) =>
  useGameStore((state) => {
    const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
    return scene?.placedProps || STABLE_EMPTY_PROPS;
  });

export const useVisibleProps = (sceneId: string) =>
  useGameStore(
    useShallow((state) => {
      const isHost = state.user.type === 'host';
      return state.getVisibleProps(sceneId, isHost);
    }),
  );

export const useDrawingActions = () =>
  useGameStore(
    useShallow((state) => ({
      createDrawing: state.createDrawing,
      updateDrawing: state.updateDrawing,
      deleteDrawing: state.deleteDrawing,
      clearDrawings: state.clearDrawings,
    })),
  );

export const useServerRoomCode = () => {
  return useGameStore((state) => state.session?.roomCode || null);
};

// Token selection selectors
export const useSelectedPlacedToken = () =>
  useGameStore((state) => {
    const { scenes, activeSceneId, selectedObjectIds } = state.sceneState;
    if (selectedObjectIds.length !== 1) {
      return null;
    }

    const scene = scenes.find((s) => s.id === activeSceneId);
    if (!scene) {
      return null;
    }

    const selectedId = selectedObjectIds[0];
    const token = scene.placedTokens?.find((t) => t.id === selectedId) || null;
    return token;
  });

// Prop selection selector
export const useSelectedPlacedProp = () =>
  useGameStore((state) => {
    const { scenes, activeSceneId, selectedObjectIds } = state.sceneState;
    if (selectedObjectIds.length !== 1) {
      return null;
    }

    const scene = scenes.find((s) => s.id === activeSceneId);
    if (!scene) {
      return null;
    }

    const selectedId = selectedObjectIds[0];
    const prop = scene.placedProps?.find((p) => p.id === selectedId) || null;
    return prop;
  });
