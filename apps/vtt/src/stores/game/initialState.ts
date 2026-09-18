/**
 * src/stores/game/initialState.ts — gameStore's default state plus the
 * browser-local persistence helpers that seed and refresh it.
 *
 * Extracted verbatim from gameStore.ts. Holds:
 *  - `getBrowserId()`, the stable `nexus-browser-id` used to link characters
 *    to this device (CLAUDE.md s.12.5)
 *  - the `nexus-settings` load/save pair
 *  - the `nexus-active-session` load/save/clear trio, which is ONE of the
 *    four places session recovery state lives (CLAUDE.md s.6) — the cookie,
 *    IndexedDB and the Zustand store are elsewhere and must still be cleared
 *    together by `resetSessionForExpiredRoom()`
 *  - `initialState`, the store's default state object
 *
 * Nothing here reads the live store, so it imports only the `GameStore` type
 * and stays out of any import cycle with gameStore.ts.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  GameConfig,
  GameState,
  PlayerCharacter,
  UserSettings,
} from '@/types/game';
import { defaultColorSchemes } from '@/utils/colorSchemes';
import type { GameStore } from '@/stores/game/types';

// Generate a stable browser ID for linking characters to this "device/browser"
export const getBrowserId = (): string => {
  const stored = localStorage.getItem('nexus-browser-id');
  if (stored) return stored;

  const newId = uuidv4();
  localStorage.setItem('nexus-browser-id', newId);
  return newId;
};

// Settings persistence helpers
const SETTINGS_STORAGE_KEY = 'nexus-settings';

export const saveSettingsToStorage = (settings: UserSettings): void => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings to storage:', error);
  }
};

export const loadSettingsFromStorage = (): Partial<UserSettings> | null => {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load settings from storage:', error);
    return null;
  }
};

// Session persistence helpers
const SESSION_STORAGE_KEY = 'nexus-active-session';

export interface PersistedSession {
  userName: string;
  userType: 'player' | 'host';
  userId: string; // Store user ID to preserve identity on reconnect
  roomCode: string;
  gameConfig?: GameConfig;
  timestamp: number;
}

export const saveSessionToStorage = (state: GameStore): void => {
  if (state.user.name && state.user.type && state.session?.roomCode) {
    const session: PersistedSession = {
      userName: state.user.name,
      userType: state.user.type,
      userId: state.user.id, // Save user ID to preserve host identity
      roomCode: state.session.roomCode,
      gameConfig: state.gameConfig,
      timestamp: Date.now(),
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    console.log('💾 Saved session to localStorage:', session);
  }
};

export const loadSessionFromStorage = (): Partial<GameStore> | null => {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;

    const session: PersistedSession = JSON.parse(stored);

    // Check if session is less than 24 hours old
    const age = Date.now() - session.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (age > maxAge) {
      console.log('⏰ Session expired (older than 24 hours)');
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    console.log('📂 Loaded session from localStorage:', session);

    // Validate that we have a valid userName before restoring
    if (!session.userName || !session.userType) {
      console.log('⚠️ Stored session has invalid user data, ignoring');
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    return {
      user: {
        name: session.userName,
        type: session.userType,
        id: session.userId || getBrowserId(), // Use stored userId to preserve host identity
        color: 'blue',
        connected: false,
        isSpectator: false,
      },
      gameConfig: session.gameConfig,
      // Session will be restored with roomCode via attemptSessionRecovery
    };
  } catch (error) {
    console.error('Failed to load session from storage:', error);
    return null;
  }
};

export const clearSessionFromStorage = (): void => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  console.log('🗑️ Cleared session from localStorage');
};

export const initialState: GameState & {
  gameConfig?: GameConfig;
  selectedCharacter?: PlayerCharacter;
  isAuthenticated: boolean;
  authChecked: boolean;
} = {
  // App Flow State (from appFlowStore)
  gameConfig: undefined,
  selectedCharacter: undefined,

  // Game State
  isAuthenticated: false,
  authChecked: false,
  user: {
    id: getBrowserId(),
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
    camera: {
      x: 0,
      y: 0,
      zoom: 0.54,
    },
    followDM: true,
    activeTool: 'select' as const,
    selectedObjectIds: [],
  },
  settings: {
    // Display Settings
    colorScheme: defaultColorSchemes[1], // Emerald Depths
    theme: 'dark',
    enableGlassmorphism: false,
    persistOpenPanels: true,
    reducedMotion: false,
    fontSize: 'medium',
    panelLayout: 'original',

    // Audio Settings
    enableSounds: true,
    diceRollSounds: true,
    notificationSounds: true,
    masterVolume: 75,

    // Gameplay Settings
    autoRollInitiative: false,
    showOtherPlayersRolls: true,
    highlightActivePlayer: true,
    snapToGridByDefault: true,
    defaultGridSize: 50,
    diceDisappearTime: 3000, // 3 seconds default

    // Privacy Settings
    allowSpectators: true,
    shareCharacterSheets: false,
    logGameSessions: true,
    hpSync: true,

    // Performance Settings
    maxTokensPerScene: 100,
    imageQuality: 'medium',
    enableAnimations: true,

    // Accessibility Settings
    highContrast: false,
    screenReaderMode: false,
    keyboardNavigation: true,

    // Developer Settings
    useMockData: process.env.NODE_ENV === 'development',

    // Experimental Settings
    floatingToolbar: false, // Default to docked toolbar

    ...loadSettingsFromStorage(),
  },

  // Chat State
  chat: {
    messages: [],
    typingUsers: [],
    unreadCount: 0,
  },

  // Voice State
  voice: {
    channels: [],
    activeChannelId: null,
    isMuted: false,
    isDeafened: false,
    audioDevices: [],
    selectedInputDevice: null,
    selectedOutputDevice: null,
  },

  // Connection State
  connection: {
    isConnected: false,
    quality: 'disconnected',
    latency: 0,
    packetLoss: 0,
    lastUpdate: 0,
    reconnectAttempts: 0,
  },

  // Recovery state
  isRecovering: false,

  // Version tracking for conflict resolution
  entityVersions: new Map(),
};
