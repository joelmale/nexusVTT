/**
 * src/stores/game/types.ts — the `GameStore` shape and the set/get signatures
 * its slice factories are handed.
 *
 * This module holds ONLY types. It exists so that the slice factories under
 * `src/stores/game/` can be typed against the full store without importing
 * `@/stores/gameStore` — `scripts/check-import-cycles.js` counts type-only
 * imports, so a slice importing the interface from gameStore.ts would be a
 * static cycle (gameStore -> slice -> gameStore).
 */

import type { WritableDraft } from 'immer';
import type {
  PlayerCharacter,
  GameConfig,
  GameState,
  User,
  Session,
  DiceRoll,
  TabType,
  GameEvent,
  Scene,
  Camera,
  UserSettings,
  ColorScheme,
  Drawing,
  PlacedToken,
  PlacedProp,
  ChatMessage,
  VoiceChannel,
  ConnectionState,
} from '@/types/game';
import type { FogShape } from '@/types/fog';

export interface PendingUpdate {
  id: string;
  type: string;
  localState: (PlacedToken | PlacedProp) & { sceneId: string };
  timestamp: number;
  previousVersion?: number; // Store the version before optimistic update for rollback
}

export interface GameStore extends GameState {
  isAuthenticated: boolean;
  /** True once the initial /auth/me check has resolved (regardless of outcome).
   *  Lets guards distinguish "auth still loading" from "confirmed signed out". */
  authChecked: boolean;
  // Core Actions
  setUser: (user: Partial<User>) => void;
  setSession: (session: Session | null) => void;
  addDiceRoll: (roll: DiceRoll) => void;
  setActiveTab: (tab: TabType) => void;
  applyEvent: (event: GameEvent) => void;
  reset: () => void;
  resetSessionForExpiredRoom: () => void;

  // Auth Actions
  login: (user: User) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;

  // App Flow Actions (from appFlowStore)
  gameConfig?: GameConfig;
  selectedCharacter?: PlayerCharacter;
  joinRoomWithCode: (
    roomCode: string,
    character?: PlayerCharacter,
  ) => Promise<string>;
  createGameRoom: (
    config: GameConfig,
    clearExistingData?: boolean,
  ) => Promise<string>;
  leaveRoom: () => Promise<void>;
  resetToWelcome: () => void;

  // Character Management Actions (from appFlowStore)
  createCharacter: (
    characterData: Omit<PlayerCharacter, 'id' | 'createdAt' | 'playerId'>,
  ) => PlayerCharacter;
  selectCharacter: (characterId: string) => void;
  saveCharacter: (character: PlayerCharacter) => void;
  getSavedCharacters: () => PlayerCharacter[];
  deleteCharacter: (characterId: string) => void;
  exportCharacters: () => string;
  importCharacters: (jsonData: string) => PlayerCharacter[];

  // Note: Lifecycle system removed - games now start online immediately
  leaveGame: () => void;

  // Scene Actions
  createScene: (
    scene: Omit<Scene, 'id' | 'createdAt' | 'updatedAt' | 'roomCode'>,
  ) => Scene;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;
  deleteScene: (sceneId: string) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  replaceScenesFromBackup: (
    scenes: Scene[],
    activeSceneId?: string | null,
  ) => Promise<void>;
  setActiveScene: (sceneId: string) => void;
  updateCamera: (camera: Partial<Camera>) => void;
  setFollowDM: (follow: boolean) => void;
  setActiveTool: (tool: string) => void;
  syncGameStateToServer: () => void;

  // Bulk Scene Operations
  deleteScenesById: (sceneIds: string[]) => void;
  updateScenesVisibility: (
    sceneIds: string[],
    visibility: Scene['visibility'],
  ) => void;
  duplicateScene: (sceneId: string) => Scene | null;

  // Selection Actions
  setSelection: (objectIds: string[]) => void;
  addToSelection: (objectIds: string[]) => void;
  removeFromSelection: (objectIds: string[]) => void;
  clearSelection: () => void;

  // Drawing Actions
  createDrawing: (sceneId: string, drawing: Drawing) => void;
  updateDrawing: (
    sceneId: string,
    drawingId: string,
    updates: Partial<Drawing>,
  ) => void;
  deleteDrawing: (sceneId: string, drawingId: string) => void;
  clearDrawings: (sceneId: string, layer?: string) => void;
  getSceneDrawings: (sceneId: string) => Drawing[];
  getVisibleDrawings: (sceneId: string, isHost: boolean) => Drawing[];

  // Fog of War Actions (A9) — host-authored; optimistic-apply locally then
  // relay the complete SceneFog via webSocketService.sendEvent (unversioned,
  // mirrors token/place).
  setFogEnabled: (sceneId: string, enabled: boolean) => Promise<void>;
  addFogShape: (sceneId: string, shape: FogShape) => Promise<void>;
  clearFog: (sceneId: string) => Promise<void>;

  // Settings Actions
  updateSettings: (settings: Partial<UserSettings>) => void;
  setColorScheme: (colorScheme: ColorScheme) => void;
  setEnableGlassmorphism: (enabled: boolean) => void;
  setPersistOpenPanels: (enabled: boolean) => void;
  resetSettings: () => void;

  // Token Actions
  placeToken: (sceneId: string, token: PlacedToken) => void;
  moveToken: (
    sceneId: string,
    tokenId: string,
    position: { x: number; y: number },
    rotation?: number,
  ) => void;
  updateToken: (
    sceneId: string,
    tokenId: string,
    updates: Partial<PlacedToken>,
  ) => void;
  deleteToken: (sceneId: string, tokenId: string) => void;
  getSceneTokens: (sceneId: string) => PlacedToken[];
  getVisibleTokens: (sceneId: string, isHost: boolean) => PlacedToken[];
  autoPlaceCharacterToken: (
    characterId: string,
    sceneId: string,
  ) => Promise<void>;
  autoPlacePlayerToken: (
    playerName: string,
    imageUrl?: string,
    sceneId?: string,
  ) => Promise<void>;

  // Optimistic Update Actions
  moveTokenOptimistic: (
    sceneId: string,
    tokenId: string,
    position: { x: number; y: number },
    rotation?: number,
  ) => void;
  confirmUpdate: (updateId: string) => void;
  rollbackUpdate: (updateId: string) => void;

  // Prop Actions
  placeProp: (sceneId: string, prop: PlacedProp) => void;
  moveProp: (
    sceneId: string,
    propId: string,
    position: { x: number; y: number },
    rotation?: number,
  ) => void;
  updateProp: (
    sceneId: string,
    propId: string,
    updates: Partial<PlacedProp>,
  ) => void;
  deleteProp: (sceneId: string, propId: string) => void;
  interactWithProp: (
    sceneId: string,
    propId: string,
    action: 'open' | 'close' | 'lock' | 'unlock',
  ) => void;
  getSceneProps: (sceneId: string) => PlacedProp[];
  getVisibleProps: (sceneId: string, isHost: boolean) => PlacedProp[];
  getPlacedPropById: (
    sceneId: string,
    propId: string,
  ) => PlacedProp | undefined;

  // Prop Optimistic Update Actions
  movePropOptimistic: (
    sceneId: string,
    propId: string,
    position: { x: number; y: number },
    rotation?: number,
  ) => void;
  updatePropOptimistic: (
    sceneId: string,
    propId: string,
    updates: Partial<PlacedProp>,
  ) => void;

  // Persistence Actions
  initializeFromStorage: (roomCode?: string) => Promise<void>;
  loadSceneDrawings: (sceneId: string) => Promise<void>;

  // Session Persistence Actions
  saveSessionState: () => void;
  loadSessionState: () => Promise<void>;
  attemptSessionRecovery: () => Promise<boolean>;
  clearSessionData: () => void;

  // Chat Actions
  sendChatMessage: (
    content: string,
    messageType?:
      | 'text'
      | 'dm-announcement'
      | 'whisper'
      | 'system'
      | 'dice-roll'
      | 'emote'
      | 'ooc'
      | 'combat-action',
    recipientId?: string,
    diceData?: {
      expression: string;
      results: number[];
      total: number;
      breakdown: string;
      modifier: number;
      diceType?: number;
      diceCount?: number;
      isCrit?: boolean;
      isCritFail?: boolean;
      rollType?: 'normal' | 'advantage' | 'disadvantage';
    },
  ) => void;
  addChatMessage: (message: ChatMessage['data']) => void;
  setTyping: (isTyping: boolean) => void;
  clearChat: () => void;
  markChatAsRead: () => void;

  // Voice Actions
  createVoiceChannel: (name: string) => VoiceChannel;
  joinVoiceChannel: (channelId: string) => Promise<void>;
  leaveVoiceChannel: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  setAudioDevices: (devices: MediaDeviceInfo[]) => void;
  selectAudioInput: (deviceId: string) => void;
  selectAudioOutput: (deviceId: string) => void;

  // Connection Actions
  updateConnectionState: (updates: Partial<ConnectionState>) => void;
  setConnectionQuality: (
    quality: ConnectionState['quality'],
    latency?: number,
  ) => void;

  // Version Management Actions
  getEntityVersion: (entityId: string) => number;
  incrementEntityVersion: (entityId: string) => number;

  // Host Management Actions
  transferHost: (targetUserId: string) => void;
  addCoHost: (targetUserId: string) => void;
  removeCoHost: (targetUserId: string) => void;

  // Developer Actions (from appFlowStore + existing)
  toggleMockData: (enable: boolean) => void;
  dev_quickDM: (name?: string) => Promise<void>;
  dev_quickPlayer: (name?: string, autoJoinRoom?: string) => Promise<void>;
}

/**
 * The `set` handed to slice factories: gameStore is built with the Immer
 * middleware, so this is the recipe form (`set(draft => { draft.x = 1 })`).
 * Narrower than zustand's real `set` (no replace overload), which is exactly
 * what slices are allowed to use.
 */
export type GameStoreSet = {
  (updater: (state: WritableDraft<GameStore>) => void): void;
  (partial: Partial<GameStore>): void;
};

/** The `get` handed to slice factories — the full, current store state. */
export type GameStoreGet = () => GameStore;
