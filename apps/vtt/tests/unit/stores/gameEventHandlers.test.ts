import { describe, it, expect, beforeEach } from 'vitest';
import { eventHandlers } from '@/stores/gameEventHandlers';
import { initialState } from '@/stores/game/initialState';
import type { GameState, Scene, Token, Prop, Drawing, Player } from '@/types/game';

function createTestState(): GameState {
  return {
    ...initialState,
    user: {
      id: 'test-user-1',
      name: 'Test User',
      type: 'player',
      color: 'blue',
      connected: true,
    },
    session: {
      roomCode: 'TEST',
      hostId: 'test-host-1',
      coHostIds: [],
      players: [
        {
          id: 'test-host-1',
          name: 'Host',
          type: 'host',
          color: 'red',
          connected: true,
          canEditScenes: true,
        },
        {
          id: 'test-user-1',
          name: 'Test User',
          type: 'player',
          color: 'blue',
          connected: true,
          canEditScenes: false,
        },
      ],
      status: 'connected',
      dmConnected: true,
    },
    diceRolls: [],
    sceneState: {
      scenes: [
        {
          id: 'scene-1',
          name: 'Scene 1',
          description: 'Initial scene',
          roomCode: 'TEST',
          visibility: 'public',
          isEditable: true,
          createdBy: 'test-host-1',
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
          isActive: true,
          playerCount: 2,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      activeSceneId: 'scene-1',
      camera: { x: 0, y: 0, zoom: 1 },
      followDM: true,
      activeTool: 'select',
      selectedObjectIds: [],
    },
    entityVersions: new Map(),
  };
}

describe('gameEventHandlers', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestState();
  });

  describe('dice events', () => {
    it('handles dice/roll', () => {
      const roll = {
        id: 'roll-1',
        expression: '1d20+2',
        results: [15],
        total: 17,
        timestamp: Date.now(),
        userId: 'test-user-1',
        userName: 'Test User',
      };
      eventHandlers['dice/roll'](state, { roll });
      expect(state.diceRolls).toHaveLength(1);
      expect(state.diceRolls[0]).toEqual(roll);
    });

    it('handles dice/roll-result', () => {
      const roll = {
        id: 'roll-2',
        expression: '2d6',
        results: [3, 4],
        total: 7,
        timestamp: Date.now(),
        userId: 'test-user-1',
        userName: 'Test User',
      };
      eventHandlers['dice/roll-result'](state, { roll });
      expect(state.diceRolls).toHaveLength(1);
      expect(state.diceRolls[0]).toEqual(roll);
    });
  });

  describe('token events', () => {
    const mockToken: Token = {
      id: 'token-1',
      name: 'Hero',
      imageUrl: '/hero.png',
      x: 100,
      y: 150,
      size: 1,
      rotation: 45,
      layer: 'tokens',
      elevation: 0,
      conditions: [],
      currentHP: 20,
      maxHP: 20,
      tempHP: 0,
      armorClass: 15,
      initiative: 12,
      isVisible: true,
      isLocked: false,
      createdBy: 'test-user-1',
      createdAt: 1000,
      updatedAt: 1000,
    };

    it('places a new token on the scene and initializes placedTokens if missing', () => {
      delete (state.sceneState.scenes[0] as Partial<Scene>).placedTokens;
      eventHandlers['token/place'](state, { sceneId: 'scene-1', token: mockToken });
      expect(state.sceneState.scenes[0].placedTokens).toBeDefined();
      expect(state.sceneState.scenes[0].placedTokens).toHaveLength(1);
      expect(state.sceneState.scenes[0].placedTokens[0].id).toBe('token-1');
    });

    it('updates an existing token if placed with same id', () => {
      state.sceneState.scenes[0].placedTokens = [{ ...mockToken, name: 'Old Name' }];
      eventHandlers['token/place'](state, { sceneId: 'scene-1', token: mockToken });
      expect(state.sceneState.scenes[0].placedTokens).toHaveLength(1);
      expect(state.sceneState.scenes[0].placedTokens[0].name).toBe('Hero');
    });

    it('moves a token and updates entity version', () => {
      state.sceneState.scenes[0].placedTokens = [{ ...mockToken }];
      eventHandlers['token/move'](state, {
        sceneId: 'scene-1',
        tokenId: 'token-1',
        position: { x: 200, y: 300 },
        rotation: 90,
      });

      const moved = state.sceneState.scenes[0].placedTokens[0];
      expect(moved.x).toBe(200);
      expect(moved.y).toBe(300);
      expect(moved.rotation).toBe(90);
      expect(state.entityVersions.get('token-1')).toBe(1);
    });

    it('updates a token with partial updates and increments version', () => {
      state.sceneState.scenes[0].placedTokens = [{ ...mockToken }];
      eventHandlers['token/update'](state, {
        sceneId: 'scene-1',
        tokenId: 'token-1',
        updates: { currentHP: 12, name: 'Injured Hero' },
      });

      const updated = state.sceneState.scenes[0].placedTokens[0];
      expect(updated.currentHP).toBe(12);
      expect(updated.name).toBe('Injured Hero');
      expect(state.entityVersions.get('token-1')).toBe(1);
    });

    it('deletes a token from scene and increments version', () => {
      state.sceneState.scenes[0].placedTokens = [{ ...mockToken }];
      eventHandlers['token/delete'](state, {
        sceneId: 'scene-1',
        tokenId: 'token-1',
      });

      expect(state.sceneState.scenes[0].placedTokens).toHaveLength(0);
      expect(state.entityVersions.get('token-1')).toBe(1);
    });
  });

  describe('fog events', () => {
    it('updates scene fog completely', () => {
      const fogData = {
        enabled: true,
        shapes: [{ id: 'shape-1', type: 'rect' as const, x: 0, y: 0, width: 100, height: 100 }],
      };
      eventHandlers['fog/update'](state, { sceneId: 'scene-1', fog: fogData });
      expect(state.sceneState.scenes[0].fog).toEqual(fogData);
    });

    it('clears fog shapes but preserves enabled flag', () => {
      state.sceneState.scenes[0].fog = {
        enabled: true,
        shapes: [{ id: 'shape-1', type: 'rect' as const, x: 0, y: 0, width: 100, height: 100 }],
      };
      eventHandlers['fog/clear'](state, { sceneId: 'scene-1' });
      expect(state.sceneState.scenes[0].fog?.enabled).toBe(true);
      expect(state.sceneState.scenes[0].fog?.shapes).toEqual([]);
    });
  });

  describe('prop events', () => {
    const mockProp: Prop = {
      id: 'prop-1',
      name: 'Wooden Door',
      category: 'doors',
      x: 50,
      y: 80,
      rotation: 0,
      layer: 'props',
      isVisible: true,
      isLocked: false,
      createdBy: 'test-host-1',
      createdAt: 1000,
      updatedAt: 1000,
      currentStats: { state: 'closed', locked: false },
    };

    it('places a prop on the scene and creates placedProps array if needed', () => {
      delete (state.sceneState.scenes[0] as Partial<Scene>).placedProps;
      eventHandlers['prop/place'](state, { sceneId: 'scene-1', prop: mockProp });
      expect(state.sceneState.scenes[0].placedProps).toHaveLength(1);
      expect(state.sceneState.scenes[0].placedProps[0].id).toBe('prop-1');
    });

    it('moves a prop and increments entity version', () => {
      state.sceneState.scenes[0].placedProps = [{ ...mockProp }];
      eventHandlers['prop/move'](state, {
        sceneId: 'scene-1',
        propId: 'prop-1',
        position: { x: 120, y: 140 },
        rotation: 180,
      });

      const moved = state.sceneState.scenes[0].placedProps[0];
      expect(moved.x).toBe(120);
      expect(moved.y).toBe(140);
      expect(moved.rotation).toBe(180);
      expect(state.entityVersions.get('prop-1')).toBe(1);
    });

    it('updates a prop and increments entity version', () => {
      state.sceneState.scenes[0].placedProps = [{ ...mockProp }];
      eventHandlers['prop/update'](state, {
        sceneId: 'scene-1',
        propId: 'prop-1',
        updates: { name: 'Iron Door' },
      });

      expect(state.sceneState.scenes[0].placedProps[0].name).toBe('Iron Door');
      expect(state.entityVersions.get('prop-1')).toBe(1);
    });

    it('deletes a prop and increments entity version', () => {
      state.sceneState.scenes[0].placedProps = [{ ...mockProp }];
      eventHandlers['prop/delete'](state, {
        sceneId: 'scene-1',
        propId: 'prop-1',
      });

      expect(state.sceneState.scenes[0].placedProps).toHaveLength(0);
      expect(state.entityVersions.get('prop-1')).toBe(1);
    });

    it('handles prop interaction: open, close, lock, unlock', () => {
      state.sceneState.scenes[0].placedProps = [{ ...mockProp }];

      eventHandlers['prop/interact'](state, {
        sceneId: 'scene-1',
        propId: 'prop-1',
        action: 'open',
      });
      expect(state.sceneState.scenes[0].placedProps[0].currentStats?.state).toBe('open');

      eventHandlers['prop/interact'](state, {
        sceneId: 'scene-1',
        propId: 'prop-1',
        action: 'lock',
      });
      expect(state.sceneState.scenes[0].placedProps[0].currentStats?.state).toBe('locked');
      expect(state.sceneState.scenes[0].placedProps[0].currentStats?.locked).toBe(true);

      eventHandlers['prop/interact'](state, {
        sceneId: 'scene-1',
        propId: 'prop-1',
        action: 'unlock',
      });
      expect(state.sceneState.scenes[0].placedProps[0].currentStats?.state).toBe('closed');
      expect(state.sceneState.scenes[0].placedProps[0].currentStats?.locked).toBe(false);

      eventHandlers['prop/interact'](state, {
        sceneId: 'scene-1',
        propId: 'prop-1',
        action: 'close',
      });
      expect(state.sceneState.scenes[0].placedProps[0].currentStats?.state).toBe('closed');
    });
  });

  describe('user and session events', () => {
    it('handles user/join for existing and new players', () => {
      // Existing player
      eventHandlers['user/join'](state, {
        user: { id: 'test-user-1', name: 'Updated Name', color: 'green' },
      });
      expect(state.session?.players.find((p: Player) => p.id === 'test-user-1')?.name).toBe('Updated Name');

      // New player
      eventHandlers['user/join'](state, {
        user: { id: 'player-3', name: 'New Player', type: 'player', color: 'purple', connected: true },
      });
      expect(state.session?.players).toHaveLength(3);
      expect(state.session?.players.find((p: Player) => p.id === 'player-3')?.canEditScenes).toBe(false);
    });

    it('handles user/leave', () => {
      eventHandlers['user/leave'](state, { userId: 'test-user-1' });
      expect(state.session?.players.find((p: Player) => p.id === 'test-user-1')).toBeUndefined();
    });

    it('handles session/created with default scene and campaign scenes', () => {
      state.sceneState.scenes = [];
      state.sceneState.activeSceneId = null;

      eventHandlers['session/created'](state, { roomCode: 'NEWROOM' });
      expect(state.session?.roomCode).toBe('NEWROOM');
      expect(state.user.type).toBe('host');
      expect(state.sceneState.scenes).toHaveLength(1);
      expect(state.sceneState.scenes[0].name).toBe('Scene 1');

      // Now with campaign scenes
      const campaignScene: Partial<Scene> = {
        id: 'camp-1',
        name: 'Campaign Scene',
      };
      eventHandlers['session/created'](state, {
        roomCode: 'CAMP大切',
        campaignScenes: [campaignScene],
      });
      expect(state.sceneState.scenes[0].id).toBe('camp-1');
      expect(state.sceneState.activeSceneId).toBe('camp-1');
    });

    it('handles session/joined for player and host', () => {
      state.user.id = 'player-10';
      eventHandlers['session/joined'](state, {
        roomCode: 'JOIN1',
        hostId: 'host-99',
        coHostIds: ['cohost-1'],
        players: [],
      });
      expect(state.user.type).toBe('player');
      expect(state.session?.roomCode).toBe('JOIN1');

      // Joins as co-host
      state.user.id = 'cohost-1';
      eventHandlers['session/joined'](state, {
        roomCode: 'JOIN1',
        hostId: 'host-99',
        coHostIds: ['cohost-1'],
      });
      expect(state.user.type).toBe('host');
    });

    it('handles session/join for peer discovery and reconnection', () => {
      eventHandlers['session/join'](state, {
        uuid: 'new-peer',
        player: {
          id: 'new-peer',
          name: 'Peer',
          type: 'player',
          color: 'orange',
          connected: true,
          canEditScenes: false,
        },
      });
      expect(state.session?.players.find((p: Player) => p.id === 'new-peer')).toBeDefined();

      // De-dupe / reconnect
      eventHandlers['session/join'](state, {
        uuid: 'new-peer',
        player: {
          id: 'new-peer',
          name: 'Peer Renamed',
          type: 'player',
          color: 'orange',
          connected: true,
          canEditScenes: false,
        },
      });
      expect(state.session?.players.find((p: Player) => p.id === 'new-peer')?.name).toBe('Peer Renamed');
    });

    it('handles session/reconnected with and without prior session', () => {
      eventHandlers['session/reconnected'](state, {
        roomCode: 'RECON1',
        hostId: 'test-user-1',
      });
      expect(state.session?.roomCode).toBe('RECON1');
      expect(state.user.type).toBe('host');

      state.session = null;
      state.user.type = 'player';
      eventHandlers['session/reconnected'](state, {
        roomCode: 'RECON2',
        hostId: 'other-host',
      });
      expect(state.session?.roomCode).toBe('RECON2');
      expect(state.user.type).toBe('player');
    });

    it('handles session/host-reconnected and session/dm-status', () => {
      eventHandlers['session/host-reconnected'](state, { uuid: 'test-host-1' });
      expect(state.session?.players.find((p: Player) => p.id === 'test-host-1')?.connected).toBe(true);

      eventHandlers['session/dm-status'](state, { dmConnected: false });
      expect(state.session?.dmConnected).toBe(false);
    });

    it('handles session/host-changed and updates local user permissions', () => {
      // Test user becomes host
      eventHandlers['session/host-changed'](state, {
        oldHostId: 'test-host-1',
        newHostId: 'test-user-1',
        reason: 'Host left',
      });
      expect(state.session?.hostId).toBe('test-user-1');
      expect(state.user.type).toBe('host');

      // Test user demoted back to player
      eventHandlers['session/host-changed'](state, {
        oldHostId: 'test-user-1',
        newHostId: 'test-host-1',
        reason: 'Host returned',
      });
      expect(state.user.type).toBe('player');
    });

    it('handles session/leave player disconnect status', () => {
      eventHandlers['session/leave'](state, { uuid: 'test-user-1' });
      expect(state.session?.players.find((p: Player) => p.id === 'test-user-1')?.connected).toBe(false);
    });

    it('handles session/cohost-added and session/cohost-removed', () => {
      eventHandlers['session/cohost-added'](state, { coHostId: 'test-user-1' });
      expect(state.session?.coHostIds).toContain('test-user-1');
      expect(state.session?.players.find((p: Player) => p.id === 'test-user-1')?.canEditScenes).toBe(true);
      expect(state.user.type).toBe('host');

      eventHandlers['session/cohost-removed'](state, { coHostId: 'test-user-1' });
      expect(state.session?.coHostIds).not.toContain('test-user-1');
      expect(state.session?.players.find((p: Player) => p.id === 'test-user-1')?.canEditScenes).toBe(false);
      expect(state.user.type).toBe('player');
    });
  });

  describe('scene management events', () => {
    it('handles scene/create', () => {
      const newScene: Scene = {
        ...state.sceneState.scenes[0],
        id: 'scene-2',
        name: 'Scene 2',
      };
      eventHandlers['scene/create'](state, { scene: newScene });
      expect(state.sceneState.scenes).toHaveLength(2);
      expect(state.sceneState.scenes[1].name).toBe('Scene 2');
    });

    it('handles scene/update', () => {
      eventHandlers['scene/update'](state, {
        sceneId: 'scene-1',
        updates: { name: 'Renamed Scene' },
      });
      expect(state.sceneState.scenes[0].name).toBe('Renamed Scene');
    });

    it('handles scene/delete and falls back activeSceneId', () => {
      const secondScene: Scene = {
        ...state.sceneState.scenes[0],
        id: 'scene-2',
        name: 'Scene 2',
      };
      state.sceneState.scenes.push(secondScene);
      state.sceneState.activeSceneId = 'scene-1';

      eventHandlers['scene/delete'](state, { sceneId: 'scene-1' });
      expect(state.sceneState.scenes).toHaveLength(1);
      expect(state.sceneState.activeSceneId).toBe('scene-2');
    });

    it('handles scene/change and resets camera', () => {
      const secondScene: Scene = {
        ...state.sceneState.scenes[0],
        id: 'scene-2',
        name: 'Scene 2',
      };
      state.sceneState.scenes.push(secondScene);

      eventHandlers['scene/change'](state, { sceneId: 'scene-2' });
      expect(state.sceneState.activeSceneId).toBe('scene-2');
      expect(state.sceneState.camera).toEqual({ x: 0, y: 0, zoom: 0.54 });
    });
  });

  describe('drawing and camera events', () => {
    const mockDrawing: Drawing = {
      id: 'draw-1',
      type: 'freehand',
      points: [0, 0, 10, 10],
      color: '#ff0000',
      width: 2,
      opacity: 1,
      layer: 'drawings',
      createdBy: 'test-user-1',
      createdAt: 1000,
      updatedAt: 1000,
    };

    it('handles camera/move and camera/update', () => {
      eventHandlers['camera/move'](state, { camera: { x: 50, y: 60, zoom: 2 } });
      expect(state.sceneState.camera).toEqual({ x: 50, y: 60, zoom: 2 });

      eventHandlers['camera/update'](state, {
        sceneId: 'scene-1',
        camera: { x: 80, y: 90, zoom: 1.5 },
      });
      expect(state.sceneState.camera).toEqual({ x: 80, y: 90, zoom: 1.5 });

      // camera/update on inactive scene is ignored
      eventHandlers['camera/update'](state, {
        sceneId: 'inactive-scene',
        camera: { x: 999, y: 999 },
      });
      expect(state.sceneState.camera.x).toBe(80);
    });

    it('creates, updates, deletes, and clears drawings', () => {
      // Create
      eventHandlers['drawing/create'](state, { sceneId: 'scene-1', drawing: mockDrawing });
      expect(state.sceneState.scenes[0].drawings).toHaveLength(1);

      // Update
      eventHandlers['drawing/update'](state, {
        sceneId: 'scene-1',
        drawingId: 'draw-1',
        updates: { color: '#00ff00' },
      });
      expect(state.sceneState.scenes[0].drawings[0].color).toBe('#00ff00');

      // Clear by layer
      state.sceneState.scenes[0].drawings.push({
        ...mockDrawing,
        id: 'draw-2',
        layer: 'fow',
      });
      eventHandlers['drawing/clear'](state, { sceneId: 'scene-1', layer: 'drawings' });
      expect(state.sceneState.scenes[0].drawings).toHaveLength(1);
      expect(state.sceneState.scenes[0].drawings[0].id).toBe('draw-2');

      // Delete
      eventHandlers['drawing/delete'](state, { sceneId: 'scene-1', drawingId: 'draw-2' });
      expect(state.sceneState.scenes[0].drawings).toHaveLength(0);

      // Clear all
      state.sceneState.scenes[0].drawings = [mockDrawing];
      eventHandlers['drawing/clear'](state, { sceneId: 'scene-1' });
      expect(state.sceneState.scenes[0].drawings).toHaveLength(0);
    });
  });

  describe('chat and general sync events', () => {
    it('handles chat/typing toggle', () => {
      eventHandlers['chat/typing'](state, {
        userId: 'peer-1',
        userName: 'Peer',
        isTyping: true,
      });
      expect(state.chat.typingUsers).toHaveLength(1);
      expect(state.chat.typingUsers[0].userId).toBe('peer-1');

      eventHandlers['chat/typing'](state, {
        userId: 'peer-1',
        userName: 'Peer',
        isTyping: false,
      });
      expect(state.chat.typingUsers).toHaveLength(0);
    });

    it('handles character/bind-to-token from peer', () => {
      state.sceneState.scenes[0].placedTokens = [
        {
          id: 'token-1',
          name: 'Token',
          imageUrl: '',
          x: 0,
          y: 0,
          size: 1,
          layer: 'tokens',
          elevation: 0,
          conditions: [],
          currentHP: 10,
          maxHP: 10,
          tempHP: 0,
          armorClass: 10,
          initiative: 0,
          isVisible: true,
          isLocked: false,
          createdBy: 'user',
          createdAt: 0,
          updatedAt: 0,
        },
      ];

      eventHandlers['character/bind-to-token'](state, {
        sourceClientId: 'remote-peer',
        characterId: 'char-123',
        tokenId: 'token-1',
        sceneId: 'scene-1',
      });

      expect(state.sceneState.scenes[0].placedTokens[0].characterId).toBe('char-123');

      // Events from self are ignored
      eventHandlers['character/bind-to-token'](state, {
        sourceClientId: state.user.id,
        characterId: 'char-456',
        tokenId: 'token-1',
        sceneId: 'scene-1',
      });
      expect(state.sceneState.scenes[0].placedTokens[0].characterId).toBe('char-123');
    });

    it('handles game-state-update', () => {
      const scenes: Scene[] = [
        {
          ...state.sceneState.scenes[0],
          id: 'server-scene',
          name: 'Server Scene',
        },
      ];
      eventHandlers['game-state-update'](state, {
        scenes,
        activeSceneId: 'server-scene',
      });

      expect(state.sceneState.scenes[0].name).toBe('Server Scene');
      expect(state.sceneState.activeSceneId).toBe('server-scene');
    });
  });
});
