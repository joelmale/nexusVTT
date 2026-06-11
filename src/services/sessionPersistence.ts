/**
 * Session Persistence Service
 *
 * Provides comprehensive session state management with client-side persistence
 * and automatic reconnection capabilities. Stores room state, character data,
 * and game settings to enable seamless session recovery on page refresh.
 *
 * Uses IndexedDB for game state (unlimited storage) and localStorage for session metadata (small)
 */

import { dungeonMapIndexedDB } from '@/services/indexedDB';

export interface PersistedSession {
  roomCode: string;
  userId: string;
  userType: 'host' | 'player';
  userName: string;
  hostId?: string;
  lastActivity: number;
  sessionVersion: number;
}

export interface PersistedGameState {
  characters: unknown[];
  initiative: unknown;
  scenes: unknown[];
  activeSceneId: string | null;
  settings: unknown;
  lastUpdated: number;
  stateVersion: number;
}

export interface SessionRecoveryData {
  session: PersistedSession | null;
  gameState: PersistedGameState | null;
  isValid: boolean;
  canReconnect: boolean;
}

class SessionPersistenceService {
  private readonly SESSION_KEY = 'nexus-session';
  private readonly GAME_STATE_KEY = 'nexus-game-state';
  private readonly SESSION_COOKIE_KEY = 'nexus-room';
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  private readonly STATE_VERSION = 1;

  /**
   * Set a cookie with expiration
   */
  private setCookie(name: string, value: string, maxAgeSeconds: number): void {
    try {
      document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax`;
    } catch (error) {
      console.error('Failed to set cookie:', error);
    }
  }

  /**
   * Get a cookie value
   */
  private getCookie(name: string): string | null {
    try {
      const nameEQ = name + '=';
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i];
        while (cookie.charAt(0) === ' ')
          cookie = cookie.substring(1, cookie.length);
        if (cookie.indexOf(nameEQ) === 0) {
          return decodeURIComponent(
            cookie.substring(nameEQ.length, cookie.length),
          );
        }
      }
    } catch (error) {
      console.error('Failed to get cookie:', error);
    }
    return null;
  }

  /**
   * Delete a cookie
   */
  private deleteCookie(name: string): void {
    try {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
    } catch (error) {
      console.error('Failed to delete cookie:', error);
    }
  }

  /**
   * Save current session data to localStorage and cookie backup
   */
  saveSession(session: PersistedSession): void {
    try {
      const sessionData = {
        ...session,
        lastActivity: Date.now(),
        sessionVersion: this.STATE_VERSION,
      };

      // Save to localStorage
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));

      // Save basic room info to cookie as backup (1 hour expiration)
      const cookieData = {
        roomCode: session.roomCode,
        userId: session.userId,
        userType: session.userType,
        userName: session.userName,
        timestamp: Date.now(),
      };
      this.setCookie(
        this.SESSION_COOKIE_KEY,
        JSON.stringify(cookieData),
        60 * 60,
      ); // 1 hour

      console.log(
        `💾 Session saved: Room ${session.roomCode} (localStorage + cookie)`,
      );
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  /**
   * Load session data from localStorage with cookie fallback
   */
  loadSession(): PersistedSession | null {
    try {
      // Try localStorage first
      const stored = localStorage.getItem(this.SESSION_KEY);
      if (stored) {
        const session: PersistedSession = JSON.parse(stored);

        // Check if session has expired
        const now = Date.now();
        if (now - session.lastActivity > this.SESSION_TIMEOUT) {
          console.log('🕐 Session expired, clearing stored data');
          this.clearSession();
          return null;
        }

        // Check version compatibility
        if (session.sessionVersion !== this.STATE_VERSION) {
          console.log('🔄 Session version mismatch, clearing stored data');
          this.clearSession();
          return null;
        }

        console.log(
          `📂 Session loaded from localStorage: Room ${session.roomCode}`,
        );
        return session;
      }

      // Fallback to cookie if localStorage is empty
      console.log('🔍 No localStorage session, checking cookie fallback...');
      const cookieData = this.getCookie(this.SESSION_COOKIE_KEY);
      if (cookieData) {
        const parsed = JSON.parse(cookieData);
        const now = Date.now();

        // Check if cookie is too old (1 hour)
        if (now - parsed.timestamp > 60 * 60 * 1000) {
          console.log('🕐 Cookie session expired');
          this.deleteCookie(this.SESSION_COOKIE_KEY);
          return null;
        }

        // Create a session from cookie data
        const session: PersistedSession = {
          roomCode: parsed.roomCode,
          userId: parsed.userId,
          userType: parsed.userType,
          userName: parsed.userName,
          lastActivity: parsed.timestamp,
          sessionVersion: this.STATE_VERSION,
        };

        console.log(`📂 Session loaded from cookie: Room ${session.roomCode}`);

        // Restore to localStorage for consistency
        this.saveSession(session);

        return session;
      }

      console.log('📂 No session found in localStorage or cookie');
      return null;
    } catch (error) {
      console.error('Failed to load session:', error);
      this.clearSession();
      return null;
    }
  }

  /**
   * Save game state to localStorage
   */
  async saveGameState(
    gameState: Omit<PersistedGameState, 'lastUpdated' | 'stateVersion'>,
  ): Promise<void> {
    try {
      // Save to IndexedDB for unlimited storage (no quota issues)
      await dungeonMapIndexedDB.saveGameState({
        id: 'current',
        scenes: gameState.scenes,
        activeSceneId: gameState.activeSceneId,
        characters: gameState.characters,
        initiative: gameState.initiative,
        settings: gameState.settings,
      });
      console.log('💾 Game state saved to IndexedDB');
    } catch (error) {
      console.error('Failed to save game state to IndexedDB:', error);
      // Fallback to localStorage (but may hit quota)
      try {
        const stateData: PersistedGameState = {
          ...gameState,
          lastUpdated: Date.now(),
          stateVersion: this.STATE_VERSION,
        };
        localStorage.setItem(this.GAME_STATE_KEY, JSON.stringify(stateData));
        console.log('💾 Game state saved to localStorage (fallback)');
      } catch (fallbackError) {
        console.error('Failed to save game state to localStorage:', fallbackError);
      }
    }
  }

  /**
   * Load game state from IndexedDB (with localStorage fallback)
   */
  async loadGameState(): Promise<PersistedGameState | null> {
    try {
      // Try to load from IndexedDB first
      const indexedDBState = await dungeonMapIndexedDB.getGameState('current');
      if (indexedDBState) {
        console.log('📂 Game state loaded from IndexedDB');
        return {
          scenes: indexedDBState.scenes,
          activeSceneId: indexedDBState.activeSceneId,
          characters: indexedDBState.characters,
          initiative: indexedDBState.initiative,
          settings: indexedDBState.settings,
          lastUpdated: indexedDBState.timestamp,
          stateVersion: indexedDBState.version,
        };
      }
    } catch (error) {
      console.error('Failed to load game state from IndexedDB:', error);
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(this.GAME_STATE_KEY);
      if (!stored) return null;

      const gameState: PersistedGameState = JSON.parse(stored);

      // Check version compatibility
      if (gameState.stateVersion !== this.STATE_VERSION) {
        console.log('🔄 Game state version mismatch, clearing stored data');
        this.clearGameState();
        return null;
      }

      console.log('📂 Game state loaded from localStorage (fallback)');
      return gameState;
    } catch (error) {
      console.error('Failed to load game state from localStorage:', error);
      this.clearGameState();
      return null;
    }
  }

  /**
   * Get complete session recovery data
   */
  async getRecoveryData(): Promise<SessionRecoveryData> {
    const session = this.loadSession();
    const gameState = await this.loadGameState();

    const isValid = session !== null;
    const canReconnect = isValid && this.isReconnectionPossible(session);

    return {
      session,
      gameState,
      isValid,
      canReconnect,
    };
  }

  /**
   * Check if reconnection is possible based on session age and validity
   */
  private isReconnectionPossible(session: PersistedSession | null): boolean {
    if (!session) return false;

    const now = Date.now();
    const sessionAge = now - session.lastActivity;

    // Allow reconnection within 1 hour for active sessions
    const RECONNECT_WINDOW = 60 * 60 * 1000; // 1 hour

    return sessionAge < RECONNECT_WINDOW;
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(): void {
    const session = this.loadSession();
    if (session) {
      this.saveSession(session);
    }
  }

  /**
   * Clear session data from both localStorage and cookies
   */
  clearSession(): void {
    try {
      localStorage.removeItem(this.SESSION_KEY);
      this.deleteCookie(this.SESSION_COOKIE_KEY);
      console.log('🗑️ Session data cleared (localStorage + cookie)');
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }

  /**
   * Clear game state data
   */
  async clearGameState(): Promise<void> {
    try {
      // Clear from IndexedDB
      await dungeonMapIndexedDB.deleteGameState('current');
      // Also clear from localStorage (fallback)
      localStorage.removeItem(this.GAME_STATE_KEY);
      console.log('🗑️ Game state cleared from IndexedDB and localStorage');
    } catch (error) {
      console.error('Failed to clear game state:', error);
    }
  }

  /**
   * Clear all persisted data
   */
  clearAll(): void {
    this.clearSession();
    this.clearGameState();
  }

  /**
   * Generate reconnection URL with session data
   */
  generateReconnectUrl(baseUrl: string): string | null {
    const session = this.loadSession();
    if (!session || !this.isReconnectionPossible(session)) {
      return null;
    }

    const params = new URLSearchParams({
      reconnect: session.roomCode,
      userId: session.userId,
      userType: session.userType,
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Check if there's a pending reconnection from URL parameters
   */
  checkForReconnection(): {
    roomCode: string;
    userId: string;
    userType: 'host' | 'player';
  } | null {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const roomCode = urlParams.get('reconnect');
      const userId = urlParams.get('userId');
      const userType = urlParams.get('userType') as 'host' | 'player';

      if (roomCode && userId && userType) {
        // Clear URL parameters after extracting
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );

        return { roomCode, userId, userType };
      }
    } catch (error) {
      console.error('Failed to check for reconnection:', error);
    }

    return null;
  }

  /**
   * Validate session integrity
   */
  validateSession(session: PersistedSession): boolean {
    return (
      typeof session.roomCode === 'string' &&
      typeof session.userId === 'string' &&
      ['host', 'player'].includes(session.userType) &&
      typeof session.userName === 'string' &&
      typeof session.lastActivity === 'number' &&
      typeof session.sessionVersion === 'number'
    );
  }

  /**
   * Get session statistics for debugging
   */
  async getSessionStats(): Promise<{
    hasSession: boolean;
    hasGameState: boolean;
    sessionAge: number | null;
    gameStateAge: number | null;
    canReconnect: boolean;
    hasSessionCookie: boolean;
    cookieAge: number | null;
  }> {
    const session = this.loadSession();
    const gameState = await this.loadGameState();
    const now = Date.now();

    // Check cookie separately for debugging
    let hasSessionCookie = false;
    let cookieAge: number | null = null;
    try {
      const cookieData = this.getCookie(this.SESSION_COOKIE_KEY);
      if (cookieData) {
        const parsed = JSON.parse(cookieData);
        hasSessionCookie = true;
        cookieAge = now - parsed.timestamp;
      }
    } catch {
      // Ignore cookie errors for stats
    }

    return {
      hasSession: session !== null,
      hasGameState: gameState !== null,
      sessionAge: session ? now - session.lastActivity : null,
      gameStateAge: gameState ? now - gameState.lastUpdated : null,
      canReconnect: this.isReconnectionPossible(session),
      hasSessionCookie,
      cookieAge,
    };
  }

  /**
   * Debug method to check all storage sources
   */
  debugStorageState(): void {
    console.log('🔍 Storage State Debug:');

    // Check localStorage
    const localStorageSession = localStorage.getItem(this.SESSION_KEY);
    const localStorageGameState = localStorage.getItem(this.GAME_STATE_KEY);
    console.log(
      '  localStorage session:',
      localStorageSession ? JSON.parse(localStorageSession) : null,
    );
    console.log(
      '  localStorage gameState:',
      localStorageGameState ? 'exists' : null,
    );

    // Check cookie
    const cookieData = this.getCookie(this.SESSION_COOKIE_KEY);
    console.log(
      '  Cookie session:',
      cookieData ? JSON.parse(cookieData) : null,
    );

    // Check recovery data
    const recoveryData = this.getRecoveryData();
    console.log('  Recovery data:', recoveryData);

    // Stats
    const stats = this.getSessionStats();
    console.log('  Stats:', stats);
  }
}

export const sessionPersistenceService = new SessionPersistenceService();
