import { v4 as uuidv4 } from 'uuid';
import type {
  CameraMoveEvent,
  ChatUserTypingEvent,
  CoHostAddedEvent,
  CoHostRemovedEvent,
  DiceRollEvent,
  DiceRollResultEvent,
  DrawingClearEvent,
  DrawingCreateEvent,
  DrawingDeleteEvent,
  DrawingUpdateEvent,
  FogClearEvent,
  FogUpdateEvent,
  GameState,
  HostChangedEvent,
  Player,
  PropDeleteEvent,
  PropInteractEvent,
  PropMoveEvent,
  PropPlaceEvent,
  PropUpdateEvent,
  Scene,
  SceneChangeEvent,
  SceneCreateEvent,
  SceneDeleteEvent,
  SceneUpdateEvent,
  SessionCreatedEvent,
  SessionJoinedEvent,
  Token,
  TokenDeleteEvent,
  TokenMoveEvent,
  TokenPlaceEvent,
  TokenUpdateEvent,
  UserJoinEvent,
  UserLeaveEvent,
} from '@/types/game';

type EventHandler = (state: GameState, data: unknown) => void;

export const eventHandlers: Record<string, EventHandler> = {
  'dice/roll': (state, data) => {
    const eventData = data as DiceRollEvent['data'];
    if (eventData.roll) {
      state.diceRolls.unshift(eventData.roll);
    }
  },
  'dice/roll-result': (state, data) => {
    // Handle server-authoritative dice roll results
    const eventData = data as DiceRollResultEvent['data'];
    if (eventData.roll) {
      state.diceRolls.unshift(eventData.roll);
      console.log('🎲 Added dice roll to history:', eventData.roll);
    }
  },
  'token/place': (state, data) => {
    const eventData = data as TokenPlaceEvent['data'];
    if (eventData.sceneId && eventData.token) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0) {
        if (!state.sceneState.scenes[sceneIndex].placedTokens) {
          state.sceneState.scenes[sceneIndex].placedTokens = [];
        }
        state.sceneState.scenes[sceneIndex].placedTokens.push(eventData.token);
        state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
      }
    }
  },
  // Fog of War (A9): remote-echo application for a peer's fog paint/toggle.
  // Full-state replace — the payload always carries the complete SceneFog,
  // so applying it is just an overwrite (no incremental merge needed).
  'fog/update': (state, data) => {
    const eventData = data as FogUpdateEvent['data'];
    if (eventData.sceneId && eventData.fog) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0) {
        state.sceneState.scenes[sceneIndex].fog = eventData.fog;
        state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
      }
    }
  },
  'fog/clear': (state, data) => {
    const eventData = data as FogClearEvent['data'];
    if (eventData.sceneId) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0) {
        const existing = state.sceneState.scenes[sceneIndex].fog;
        state.sceneState.scenes[sceneIndex].fog = {
          enabled: existing?.enabled ?? false,
          shapes: [],
        };
        state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
      }
    }
  },
  'token/add-custom': (_state, data) => {
    const eventData = data as { token?: Token };
    if (!eventData.token) return;
    const token = eventData.token; // Capture token in closure
    void (async () => {
      const { tokenAssetManager } = await import('@/services/tokenAssets');
      await tokenAssetManager.initialize();
      if (tokenAssetManager.getTokenById(token.id)) return;

      const libraries = tokenAssetManager.getLibraries();
      let targetLibrary = libraries.find((lib) => lib.name === 'Custom Tokens');
      if (!targetLibrary) {
        targetLibrary = tokenAssetManager.createCustomLibrary(
          'Custom Tokens',
          'User-created custom tokens',
        );
      }

      tokenAssetManager.addCustomTokenWithId(targetLibrary.id, token);
    })();
  },
  'token/move': (state, data) => {
    const eventData = data as TokenMoveEvent['data'];

    // This handler only runs for moves from other clients
    // (applyEvent filters out confirmations of our own optimistic updates)

    if (eventData.sceneId && eventData.tokenId) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0 && state.sceneState.scenes[sceneIndex].placedTokens) {
        const tokenIndex = state.sceneState.scenes[
          sceneIndex
        ].placedTokens.findIndex((t) => t.id === eventData.tokenId);
        if (tokenIndex >= 0) {
          state.sceneState.scenes[sceneIndex].placedTokens[tokenIndex].x =
            eventData.position.x;
          state.sceneState.scenes[sceneIndex].placedTokens[tokenIndex].y =
            eventData.position.y;
          if (eventData.rotation !== undefined) {
            state.sceneState.scenes[sceneIndex].placedTokens[
              tokenIndex
            ].rotation = eventData.rotation;
          }
          state.sceneState.scenes[sceneIndex].placedTokens[
            tokenIndex
          ].updatedAt = Date.now();
          state.sceneState.scenes[sceneIndex].updatedAt = Date.now();

          // Increment version for conflict resolution
          const currentVersion =
            state.entityVersions.get(eventData.tokenId) || 0;
          state.entityVersions.set(eventData.tokenId, currentVersion + 1);
        }
      }
    }
  },
  'token/update': (state, data) => {
    const eventData = data as TokenUpdateEvent['data'];
    if (eventData.sceneId && eventData.tokenId && eventData.updates) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0 && state.sceneState.scenes[sceneIndex].placedTokens) {
        const tokenIndex = state.sceneState.scenes[
          sceneIndex
        ].placedTokens.findIndex((t) => t.id === eventData.tokenId);
        if (tokenIndex >= 0) {
          state.sceneState.scenes[sceneIndex].placedTokens[tokenIndex] = {
            ...state.sceneState.scenes[sceneIndex].placedTokens[tokenIndex],
            ...eventData.updates,
            updatedAt: Date.now(),
          };
          state.sceneState.scenes[sceneIndex].updatedAt = Date.now();

          // Increment version for conflict resolution
          const currentVersion =
            state.entityVersions.get(eventData.tokenId) || 0;
          state.entityVersions.set(eventData.tokenId, currentVersion + 1);
        }
      }
    }
  },
  'token/delete': (state, data) => {
    const eventData = data as TokenDeleteEvent['data'];
    if (eventData.sceneId && eventData.tokenId) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0 && state.sceneState.scenes[sceneIndex].placedTokens) {
        state.sceneState.scenes[sceneIndex].placedTokens =
          state.sceneState.scenes[sceneIndex].placedTokens.filter(
            (t) => t.id !== eventData.tokenId,
          );
        state.sceneState.scenes[sceneIndex].updatedAt = Date.now();

        // Increment version for conflict resolution
        const currentVersion = state.entityVersions.get(eventData.tokenId) || 0;
        state.entityVersions.set(eventData.tokenId, currentVersion + 1);
      }
    }
  },
  'prop/place': (state, data) => {
    const eventData = data as PropPlaceEvent['data'];
    if (eventData.sceneId && eventData.prop) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0) {
        if (!state.sceneState.scenes[sceneIndex].placedProps) {
          state.sceneState.scenes[sceneIndex].placedProps = [];
        }
        state.sceneState.scenes[sceneIndex].placedProps.push(eventData.prop);
        state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
        console.log('🎭 Props: Placed prop on scene:', eventData.prop.id);
      }
    }
  },
  'prop/move': (state, data) => {
    const eventData = data as PropMoveEvent['data'];

    // This handler only runs for moves from other clients
    if (eventData.sceneId && eventData.propId) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0 && state.sceneState.scenes[sceneIndex].placedProps) {
        const propIndex = state.sceneState.scenes[
          sceneIndex
        ].placedProps.findIndex((p) => p.id === eventData.propId);
        if (propIndex >= 0) {
          state.sceneState.scenes[sceneIndex].placedProps[propIndex].x =
            eventData.position.x;
          state.sceneState.scenes[sceneIndex].placedProps[propIndex].y =
            eventData.position.y;
          if (eventData.rotation !== undefined) {
            state.sceneState.scenes[sceneIndex].placedProps[
              propIndex
            ].rotation = eventData.rotation;
          }
          state.sceneState.scenes[sceneIndex].placedProps[propIndex].updatedAt =
            Date.now();
          state.sceneState.scenes[sceneIndex].updatedAt = Date.now();

          // Increment version for conflict resolution
          const currentVersion =
            state.entityVersions.get(eventData.propId) || 0;
          state.entityVersions.set(eventData.propId, currentVersion + 1);
        }
      }
    }
  },
  'prop/update': (state, data) => {
    const eventData = data as PropUpdateEvent['data'];
    if (eventData.sceneId && eventData.propId && eventData.updates) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0 && state.sceneState.scenes[sceneIndex].placedProps) {
        const propIndex = state.sceneState.scenes[
          sceneIndex
        ].placedProps.findIndex((p) => p.id === eventData.propId);
        if (propIndex >= 0) {
          state.sceneState.scenes[sceneIndex].placedProps[propIndex] = {
            ...state.sceneState.scenes[sceneIndex].placedProps[propIndex],
            ...eventData.updates,
            updatedAt: Date.now(),
          };
          state.sceneState.scenes[sceneIndex].updatedAt = Date.now();

          // Increment version for conflict resolution
          const currentVersion =
            state.entityVersions.get(eventData.propId) || 0;
          state.entityVersions.set(eventData.propId, currentVersion + 1);
        }
      }
    }
  },
  'prop/delete': (state, data) => {
    const eventData = data as PropDeleteEvent['data'];
    if (eventData.sceneId && eventData.propId) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0 && state.sceneState.scenes[sceneIndex].placedProps) {
        state.sceneState.scenes[sceneIndex].placedProps =
          state.sceneState.scenes[sceneIndex].placedProps.filter(
            (p) => p.id !== eventData.propId,
          );
        state.sceneState.scenes[sceneIndex].updatedAt = Date.now();

        // Increment version for conflict resolution
        const currentVersion = state.entityVersions.get(eventData.propId) || 0;
        state.entityVersions.set(eventData.propId, currentVersion + 1);
        console.log('🎭 Props: Deleted prop:', eventData.propId);
      }
    }
  },
  'prop/interact': (state, data) => {
    const eventData = data as PropInteractEvent['data'];
    if (eventData.sceneId && eventData.propId && eventData.action) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0 && state.sceneState.scenes[sceneIndex].placedProps) {
        const propIndex = state.sceneState.scenes[
          sceneIndex
        ].placedProps.findIndex((p) => p.id === eventData.propId);
        if (propIndex >= 0) {
          const prop =
            state.sceneState.scenes[sceneIndex].placedProps[propIndex];

          if (!prop.currentStats) prop.currentStats = {};

          switch (eventData.action) {
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

          // Increment version for conflict resolution
          const currentVersion =
            state.entityVersions.get(eventData.propId) || 0;
          state.entityVersions.set(eventData.propId, currentVersion + 1);
          console.log(
            '🎭 Props: Interacted with prop:',
            eventData.propId,
            eventData.action,
          );
        }
      }
    }
  },
  'user/join': (state, data) => {
    const eventData = data as UserJoinEvent['data'];
    if (state.session && eventData.user) {
      const existingIndex = state.session.players.findIndex(
        (p) => p.id === eventData.user.id,
      ) as number;
      if (existingIndex >= 0) {
        state.session.players[existingIndex] = {
          ...state.session.players[existingIndex],
          ...eventData.user,
        };
      } else {
        // Convert User to Player by adding canEditScenes property
        const player: Player = {
          ...eventData.user,
          canEditScenes: eventData.user.type === 'host',
        };
        state.session.players.push(player);
      }
    }
  },
  'user/leave': (state, data) => {
    const eventData = data as UserLeaveEvent['data'];
    if (state.session && eventData.userId) {
      state.session.players = state.session.players.filter(
        (p) => p.id !== eventData.userId,
      );
    }
  },
  'session/created': (state, data) => {
    console.log('Creating session with data:', data);
    const eventData = data as SessionCreatedEvent['data'] & {
      campaignScenes?: unknown[];
      campaignId?: string;
      dmConnected?: boolean;
    };
    state.session = {
      roomCode: eventData.roomCode,
      hostId: state.user.id,
      coHostIds: [],
      campaignId: eventData.campaignId,
      players: [
        {
          ...state.user,
          connected: true,
          canEditScenes: state.user.type === 'host',
        },
      ],
      status: 'connected',
      dmConnected: eventData.dmConnected ?? true,
    };
    state.user.type = 'host';
    state.user.connected = true;
    state.activeTab = 'scenes';

    // Load campaign scenes if provided, otherwise create default scene
    if (
      eventData.campaignScenes &&
      Array.isArray(eventData.campaignScenes) &&
      eventData.campaignScenes.length > 0
    ) {
      console.log(
        `📚 Loading ${eventData.campaignScenes.length} campaign scenes into game state`,
      );
      state.sceneState.scenes = eventData.campaignScenes as Scene[];
      // Set first scene as active
      if (state.sceneState.scenes.length > 0) {
        state.sceneState.activeSceneId = state.sceneState.scenes[0].id;
      }
    } else if (state.sceneState.scenes.length === 0) {
      // Create default scene only if no campaign scenes and no existing scenes
      const defaultScene: Scene = {
        id: uuidv4(),
        name: 'Scene 1',
        description: 'Enter description here',
        roomCode: eventData.roomCode, // Use room code from session creation
        visibility: 'public',
        isEditable: true,
        createdBy: state.user.id,
        backgroundImage: undefined,
        gridSettings: {
          enabled: true,
          type: 'square',
          size: 50,
          color: '#ffffff',
          opacity: 0.1,
          snapToGrid: true,
          showToPlayers: true,
        },
        lightingSettings: {
          enabled: false,
          globalIllumination: true,
          ambientLight: 0.5,
          darkness: 0,
        },
        placedTokens: [],
        placedProps: [],
        drawings: [],
        isActive: false,
        playerCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      state.sceneState.scenes.push(defaultScene);
      state.sceneState.activeSceneId = defaultScene.id;
    }
    console.log('Session created:', state.session);
  },
  'session/joined': (state, data) => {
    console.log('Joining session with data:', data);
    const eventData = data as SessionJoinedEvent['data'] & {
      gameState?: {
        scenes?: unknown[];
        activeSceneId?: string | null;
      };
      dmConnected?: boolean;
    };
    state.session = {
      roomCode: eventData.roomCode,
      hostId: eventData.hostId,
      coHostIds: eventData.coHostIds || [],
      campaignId: eventData.campaignId,
      players: eventData.players || [{ ...state.user, connected: true }],
      status: 'connected',
      dmConnected: eventData.dmConnected ?? true,
    };
    // Determine user type based on host/co-host status
    if (eventData.hostId === state.user.id) {
      state.user.type = 'host';
    } else if (eventData.coHostIds?.includes(state.user.id)) {
      state.user.type = 'host'; // Co-hosts also have host privileges
    } else {
      state.user.type = 'player';
    }
    state.user.connected = true;

    // Load game state from server (for multi-device persistence)
    if (eventData.gameState && eventData.gameState.scenes) {
      state.sceneState.scenes = eventData.gameState.scenes as Scene[];
      if (eventData.gameState.activeSceneId) {
        state.sceneState.activeSceneId = eventData.gameState.activeSceneId;
      }
      console.log(
        `🎮 Loaded ${state.sceneState.scenes.length} scenes from server game state`,
      );
    }

    console.log('Session joined:', state.session);
  },
  'session/join': (state, data) => {
    // Another player has joined the session - update our player list
    const eventData = data as {
      uuid: string;
      player?: {
        id: string;
        name: string;
        type: 'player' | 'host';
        color: string;
        connected: boolean;
        canEditScenes: boolean;
      };
    };
    console.log('Player joined session:', eventData.uuid, eventData.player);

    if (!state.session) {
      console.warn('Received session/join but no active session');
      return;
    }

    // Check if player is already in the list (de-dupe)
    const existingPlayer = state.session.players.find(
      (p) => p.id === eventData.uuid,
    );
    if (existingPlayer) {
      console.log('Player already in session, updating connection status');
      existingPlayer.connected = true;
      // Update name if provided
      if (eventData.player?.name) {
        existingPlayer.name = eventData.player.name;
      }
      return;
    }

    // Add the new player to the session
    const newPlayer = eventData.player || {
      id: eventData.uuid,
      name: 'Player',
      type: 'player' as const,
      color: 'blue',
      connected: true,
      canEditScenes: false,
    };
    state.session.players.push(newPlayer);

    console.log(
      '✅ Player added to session:',
      newPlayer.name,
      'Total players:',
      state.session.players.length,
    );
  },
  'session/reconnected': (state, data) => {
    console.log('Reconnecting to session with data:', data);
    const eventData = data as {
      roomCode?: string;
      hostId?: string;
      gameState?: {
        scenes?: Scene[];
        activeSceneId?: string | null;
      };
      dmConnected?: boolean;
    };

    // Update session data if provided
    if (eventData.roomCode) {
      if (!state.session) {
        state.session = {
          roomCode: eventData.roomCode,
          hostId: eventData.hostId || state.user.id,
          players: [
            {
              ...state.user,
              connected: true,
              canEditScenes: state.user.type === 'host',
            },
          ],
          status: 'connected',
          dmConnected: eventData.dmConnected ?? true,
        };
      } else {
        state.session.roomCode = eventData.roomCode;
        state.session.hostId = eventData.hostId || state.session.hostId;
        state.session.status = 'connected';
        state.session.dmConnected = eventData.dmConnected ?? true;
      }
    }

    // Set user type based on whether they are the host
    if (eventData.hostId === state.user.id || state.user.type === 'host') {
      state.user.type = 'host';
    } else {
      state.user.type = 'player';
    }

    state.user.connected = true;

    // If gameState is provided in the reconnection, apply it
    if (eventData.gameState) {
      console.log('Restoring game state from server on reconnection');
      // Apply the game state updates
      if (eventData.gameState.scenes) {
        state.sceneState.scenes = eventData.gameState.scenes;
      }
      if (eventData.gameState.activeSceneId !== undefined) {
        state.sceneState.activeSceneId = eventData.gameState.activeSceneId;
      }
    }

    console.log('Session reconnected:', state.session);
  },
  'session/host-reconnected': (state, data) => {
    // Host has reconnected to the session
    const eventData = data as { uuid: string };
    console.log('Host reconnected to session:', eventData.uuid);

    if (!state.session) {
      console.warn('Received session/host-reconnected but no active session');
      return;
    }

    // Update host connection status in player list
    const hostPlayer = state.session.players.find(
      (p) => p.id === eventData.uuid,
    );
    if (hostPlayer) {
      hostPlayer.connected = true;
      console.log('✅ Host reconnection status updated');
    }

    // Ensure session status is connected
    state.session.status = 'connected';
  },
  'session/dm-status': (state, data) => {
    const eventData = data as { dmConnected: boolean };
    if (state.session) {
      state.session.dmConnected = eventData.dmConnected;
    }
  },
  'session/host-changed': (state, data) => {
    const eventData = data as HostChangedEvent['data'];
    if (state.session) {
      state.session.hostId = eventData.newHostId;

      // Update local user type if we became host
      if (eventData.newHostId === state.user.id) {
        state.user.type = 'host';
      } else if (eventData.oldHostId === state.user.id) {
        // Check if we were demoted to co-host or player
        const isCoHost = state.session.coHostIds?.includes(state.user.id);
        state.user.type = isCoHost ? 'host' : 'player';
      }

      console.log(
        `👑 Host changed: ${eventData.oldHostId} -> ${eventData.newHostId} (${eventData.reason})`,
      );
    }
  },
  'session/leave': (state, data) => {
    const eventData = data as { uuid: string };
    if (state.session) {
      // Update the leaving player's connection status
      const playerIndex = state.session.players.findIndex(
        (player) => player.id === eventData.uuid,
      );
      if (playerIndex >= 0) {
        state.session.players[playerIndex].connected = false;
        console.log(`👋 Player disconnected: ${eventData.uuid}`);
      }
    }
  },
  'session/cohost-added': (state, data) => {
    const eventData = data as CoHostAddedEvent['data'];
    if (state.session) {
      if (!state.session.coHostIds) {
        state.session.coHostIds = [];
      }
      if (!state.session.coHostIds.includes(eventData.coHostId)) {
        state.session.coHostIds.push(eventData.coHostId);
      }

      // Reflect the granted DM privilege on the player entry so UI (e.g. the
      // PlayerPanel toggle) stays in sync.
      const player = state.session.players.find(
        (p) => p.id === eventData.coHostId,
      );
      if (player) {
        player.canEditScenes = true;
      }

      // Update local user type if we became co-host
      if (eventData.coHostId === state.user.id) {
        state.user.type = 'host';
      }
    }
    console.log(`👥 Co-host added: ${eventData.coHostId}`);
  },
  'session/cohost-removed': (state, data) => {
    const eventData = data as CoHostRemovedEvent['data'];
    if (state.session) {
      if (state.session.coHostIds) {
        state.session.coHostIds = state.session.coHostIds.filter(
          (id) => id !== eventData.coHostId,
        );
      }

      // Reflect the revoked DM privilege on the player entry.
      const player = state.session.players.find(
        (p) => p.id === eventData.coHostId,
      );
      if (player) {
        player.canEditScenes = false;
      }

      // Update local user type if we were demoted from co-host
      if (eventData.coHostId === state.user.id) {
        state.user.type = 'player';
      }
    }
    console.log(`👥 Co-host removed: ${eventData.coHostId}`);
  },
  'scene/create': (state, data) => {
    const eventData = data as SceneCreateEvent['data'];
    if (eventData.scene) {
      state.sceneState.scenes.push(eventData.scene);
      if (state.sceneState.activeSceneId === null) {
        state.sceneState.activeSceneId = eventData.scene.id;
      }
    }
  },
  'scene/update': (state, data) => {
    const eventData = data as SceneUpdateEvent['data'];
    if (eventData.sceneId && eventData.updates) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0) {
        state.sceneState.scenes[sceneIndex] = {
          ...state.sceneState.scenes[sceneIndex],
          ...eventData.updates,
          updatedAt: Date.now(),
        };
      }
    }
  },
  'scene/delete': (state, data) => {
    const eventData = data as SceneDeleteEvent['data'];
    if (eventData.sceneId) {
      state.sceneState.scenes = state.sceneState.scenes.filter(
        (s) => s.id !== eventData.sceneId,
      );
      if (state.sceneState.activeSceneId === eventData.sceneId) {
        state.sceneState.activeSceneId =
          state.sceneState.scenes.length > 0
            ? state.sceneState.scenes[0].id
            : null;
      }
    }
  },
  'scene/change': (state, data) => {
    const eventData = data as SceneChangeEvent['data'];
    if (eventData.sceneId) {
      const sceneExists = state.sceneState.scenes.some(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneExists) {
        state.sceneState.activeSceneId = eventData.sceneId;
        state.sceneState.camera = { x: 0, y: 0, zoom: 0.54 };
      }
    }
  },
  'camera/move': (state, data) => {
    const eventData = data as CameraMoveEvent['data'];
    if (eventData.camera) {
      Object.assign(state.sceneState.camera, eventData.camera);
    }
  },
  'drawing/create': (state, data) => {
    const eventData = data as DrawingCreateEvent['data'];
    if (eventData.sceneId && eventData.drawing) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0) {
        state.sceneState.scenes[sceneIndex].drawings.push(eventData.drawing);
        state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
      }
    }
  },
  'drawing/update': (state, data) => {
    const eventData = data as DrawingUpdateEvent['data'];
    if (eventData.sceneId && eventData.drawingId && eventData.updates) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0) {
        const drawingIndex = state.sceneState.scenes[
          sceneIndex
        ].drawings.findIndex((d) => d.id === eventData.drawingId);
        if (drawingIndex >= 0) {
          Object.assign(
            state.sceneState.scenes[sceneIndex].drawings[drawingIndex],
            eventData.updates,
          );
          state.sceneState.scenes[sceneIndex].drawings[drawingIndex].updatedAt =
            Date.now();
          state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
        }
      }
    }
  },
  'drawing/delete': (state, data) => {
    const eventData = data as DrawingDeleteEvent['data'];
    if (eventData.sceneId && eventData.drawingId) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0) {
        state.sceneState.scenes[sceneIndex].drawings = state.sceneState.scenes[
          sceneIndex
        ].drawings.filter((d) => d.id !== eventData.drawingId);
        state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
      }
    }
  },
  'drawing/clear': (state, data) => {
    const eventData = data as DrawingClearEvent['data'];
    if (eventData.sceneId) {
      const sceneIndex = state.sceneState.scenes.findIndex(
        (s) => s.id === eventData.sceneId,
      );
      if (sceneIndex >= 0) {
        if (eventData.layer) {
          state.sceneState.scenes[sceneIndex].drawings =
            state.sceneState.scenes[sceneIndex].drawings.filter(
              (d) => d.layer !== eventData.layer,
            );
        } else {
          state.sceneState.scenes[sceneIndex].drawings = [];
        }
        state.sceneState.scenes[sceneIndex].updatedAt = Date.now();
      }
    }
  },
  'chat/typing': (state, data) => {
    const eventData = data as ChatUserTypingEvent['data'];
    const existingUserIndex = state.chat.typingUsers.findIndex(
      (u) => u.userId === eventData.userId,
    );

    if (eventData.isTyping) {
      // Add user to typing list if not already there
      if (existingUserIndex === -1) {
        state.chat.typingUsers.push({
          userId: eventData.userId,
          userName: eventData.userName,
        });
      }
    } else {
      // Remove user from typing list
      if (existingUserIndex >= 0) {
        state.chat.typingUsers.splice(existingUserIndex, 1);
      }
    }
  },

  // Combat Integration Events
  'combat/sync-hp': (state, data) => {
    // Handle remote HP sync from peers
    void import('@/services/characterSyncService')
      .then(({ characterSyncService }) => {
        characterSyncService.handleRemoteSync(
          data as {
            sourceClientId: string;
            characterId?: string;
            tokenId?: string;
            initiativeEntryId?: string;
            stats: {
              currentHP: number;
              tempHP?: number;
              maxHP?: number;
              armorClass?: number;
            };
          },
        );
      })
      .catch((error) => {
        console.warn('Failed to load characterSyncService:', error);
      });
  },

  'combat/add-character': (state, data) => {
    const eventData = data as {
      sourceClientId: string;
      characterId?: string;
      tokenId?: string;
      entry: {
        name: string;
        currentHP: number;
        maxHP: number;
        tempHP: number;
        armorClass: number;
        initiative: number;
        initiativeModifier: number;
        dexterityModifier: number;
        type: 'player' | 'npc' | 'monster';
      };
    };

    const userId = state.user.id;

    // Ignore events from self
    if (eventData.sourceClientId === userId) return;

    // Add to initiative with snapshot data
    void import('@/stores/initiativeStore')
      .then(({ useInitiativeStore }) => {
        const { addEntry } = useInitiativeStore.getState();
        addEntry({
          ...eventData.entry,
          characterId: eventData.characterId, // May not exist locally
          tokenId: eventData.tokenId,
          playerId:
            eventData.entry.type === 'player'
              ? eventData.characterId
              : undefined,
          conditions: [],
          isActive: false,
          isReady: false,
          isDelayed: false,
          notes: '',
          deathSaves: { successes: 0, failures: 0 },
        });

        console.log(
          '⚔️ Added character to combat from peer:',
          eventData.entry.name,
        );
      })
      .catch((error) => {
        console.warn('Failed to load initiative store:', error);
      });
  },

  'character/bind-to-token': (state, data) => {
    const eventData = data as {
      sourceClientId: string;
      characterId: string;
      tokenId: string;
      sceneId: string;
    };

    // Ignore events from self
    if (eventData.sourceClientId === state.user.id) return;

    const scene = state.sceneState.scenes.find(
      (s) => s.id === eventData.sceneId,
    );
    if (!scene) return;

    const token = scene.placedTokens?.find((t) => t.id === eventData.tokenId);
    if (token) {
      token.characterId = eventData.characterId;
      token.updatedAt = Date.now();
      console.log(
        '🔗 Bound character to token (remote):',
        eventData.characterId,
        eventData.tokenId,
      );
    }
  },

  // Camera sync for players following DM
  'camera/update': (state, data) => {
    const eventData = data as {
      sceneId: string;
      camera: {
        x?: number;
        y?: number;
        zoom?: number;
      };
    };

    // Only apply camera updates to the active scene
    if (eventData.sceneId === state.sceneState.activeSceneId) {
      if (eventData.camera.x !== undefined) {
        state.sceneState.camera.x = eventData.camera.x;
      }
      if (eventData.camera.y !== undefined) {
        state.sceneState.camera.y = eventData.camera.y;
      }
      if (eventData.camera.zoom !== undefined) {
        state.sceneState.camera.zoom = eventData.camera.zoom;
      }
    }
  },

  // Full game state synchronization from server/host
  'game-state-update': (state, data) => {
    const eventData = data as {
      scenes?: Scene[];
      activeSceneId?: string | null;
    };

    if (eventData.scenes) {
      state.sceneState.scenes = eventData.scenes;
      console.log(
        '🎮 Updated scenes from game-state-update:',
        eventData.scenes.length,
      );
    }

    if (eventData.activeSceneId !== undefined) {
      state.sceneState.activeSceneId = eventData.activeSceneId;
    }
  },
};
