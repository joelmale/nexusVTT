import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sessionPersistenceService,
  type PersistedSession,
  type PersistedGameState,
} from '@/services/sessionPersistence';
import { dungeonMapIndexedDB } from '@/services/indexedDB';

vi.mock('@/services/indexedDB', () => ({
  dungeonMapIndexedDB: {
    saveGameState: vi.fn(),
    getGameState: vi.fn(),
    deleteGameState: vi.fn(),
  },
}));

describe('SessionPersistenceService', () => {
  const mockSession: PersistedSession = {
    roomCode: 'ABCD',
    userId: 'user-1',
    userType: 'host',
    userName: 'Host User',
    lastActivity: Date.now(),
    sessionVersion: 1,
  };

  const mockGameState: Omit<PersistedGameState, 'lastUpdated' | 'stateVersion'> = {
    characters: [{ id: 'char-1', name: 'Hero' }],
    initiative: { round: 1 },
    scenes: [{ id: 'scene-1', name: 'Dungeon' }],
    activeSceneId: 'scene-1',
    settings: { theme: 'dark' },
  };

  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'nexus-room=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    document.cookie = 'nexus-room=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
  });

  describe('Session Storage and Cookies', () => {
    it('saves and loads session from localStorage', () => {
      sessionPersistenceService.saveSession(mockSession);

      const loaded = sessionPersistenceService.loadSession();
      expect(loaded).not.toBeNull();
      expect(loaded?.roomCode).toBe('ABCD');
      expect(loaded?.userId).toBe('user-1');
      expect(loaded?.userType).toBe('host');
    });

    it('returns null and clears expired session from localStorage', () => {
      const expiredSession = {
        ...mockSession,
        lastActivity: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      };
      localStorage.setItem('nexus-session', JSON.stringify(expiredSession));

      const loaded = sessionPersistenceService.loadSession();
      expect(loaded).toBeNull();
      expect(localStorage.getItem('nexus-session')).toBeNull();
    });

    it('returns null and clears session when session version mismatches', () => {
      const invalidVersionSession = {
        ...mockSession,
        sessionVersion: 999,
      };
      localStorage.setItem('nexus-session', JSON.stringify(invalidVersionSession));

      const loaded = sessionPersistenceService.loadSession();
      expect(loaded).toBeNull();
      expect(localStorage.getItem('nexus-session')).toBeNull();
    });

    it('falls back to cookie when localStorage is empty', () => {
      const cookieData = {
        roomCode: 'COOKIE_ROOM',
        userId: 'cookie-user',
        userType: 'player',
        userName: 'Cookie Player',
        timestamp: Date.now(),
      };
      document.cookie = `nexus-room=${encodeURIComponent(JSON.stringify(cookieData))}; path=/;`;

      const loaded = sessionPersistenceService.loadSession();
      expect(loaded).not.toBeNull();
      expect(loaded?.roomCode).toBe('COOKIE_ROOM');
      expect(loaded?.userName).toBe('Cookie Player');
      // Should also mirror back to localStorage
      expect(localStorage.getItem('nexus-session')).toContain('COOKIE_ROOM');
    });

    it('ignores cookie if cookie has expired (> 1 hour)', () => {
      const expiredCookie = {
        roomCode: 'OLD_ROOM',
        userId: 'old-user',
        userType: 'player',
        userName: 'Old Player',
        timestamp: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago
      };
      document.cookie = `nexus-room=${encodeURIComponent(JSON.stringify(expiredCookie))}; path=/;`;

      const loaded = sessionPersistenceService.loadSession();
      expect(loaded).toBeNull();
    });

    it('clears session from both localStorage and cookies', () => {
      sessionPersistenceService.saveSession(mockSession);
      sessionPersistenceService.clearSession();

      expect(localStorage.getItem('nexus-session')).toBeNull();
      expect(document.cookie).not.toContain('nexus-room=');
    });

    it('updates activity timestamp', () => {
      sessionPersistenceService.saveSession({
        ...mockSession,
        lastActivity: Date.now() - 10000,
      });
      const initial = sessionPersistenceService.loadSession();

      sessionPersistenceService.updateActivity();
      const updated = sessionPersistenceService.loadSession();
      expect(updated!.lastActivity).toBeGreaterThanOrEqual(initial!.lastActivity);
    });
  });

  describe('Game State Persistence', () => {
    it('saves game state to IndexedDB', async () => {
      vi.mocked(dungeonMapIndexedDB.saveGameState).mockResolvedValue(undefined);

      await sessionPersistenceService.saveGameState(mockGameState);

      expect(dungeonMapIndexedDB.saveGameState).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'current',
          activeSceneId: 'scene-1',
        }),
      );
    });

    it('falls back to localStorage when IndexedDB save fails', async () => {
      vi.mocked(dungeonMapIndexedDB.saveGameState).mockRejectedValue(new Error('IDB failure'));

      await sessionPersistenceService.saveGameState(mockGameState);

      expect(localStorage.getItem('nexus-game-state')).not.toBeNull();
      const stored = JSON.parse(localStorage.getItem('nexus-game-state')!);
      expect(stored.activeSceneId).toBe('scene-1');
    });

    it('loads game state from IndexedDB when present', async () => {
      vi.mocked(dungeonMapIndexedDB.getGameState).mockResolvedValue({
        id: 'current',
        scenes: [{ id: 's1' }],
        activeSceneId: 's1',
        characters: [],
        initiative: {},
        settings: {},
        timestamp: 12345,
        version: 1,
      });

      const loaded = await sessionPersistenceService.loadGameState();
      expect(loaded).not.toBeNull();
      expect(loaded?.activeSceneId).toBe('s1');
      expect(loaded?.stateVersion).toBe(1);
    });

    it('falls back to loading game state from localStorage when IndexedDB is empty', async () => {
      vi.mocked(dungeonMapIndexedDB.getGameState).mockResolvedValue(null);
      localStorage.setItem(
        'nexus-game-state',
        JSON.stringify({
          scenes: [{ id: 'ls-s1' }],
          activeSceneId: 'ls-s1',
          characters: [],
          initiative: {},
          settings: {},
          lastUpdated: 54321,
          stateVersion: 1,
        }),
      );

      const loaded = await sessionPersistenceService.loadGameState();
      expect(loaded).not.toBeNull();
      expect(loaded?.activeSceneId).toBe('ls-s1');
    });

    it('clears game state from IndexedDB and localStorage', async () => {
      vi.mocked(dungeonMapIndexedDB.deleteGameState).mockResolvedValue(undefined);
      localStorage.setItem('nexus-game-state', 'something');

      await sessionPersistenceService.clearGameState();

      expect(dungeonMapIndexedDB.deleteGameState).toHaveBeenCalledWith('current');
      expect(localStorage.getItem('nexus-game-state')).toBeNull();
    });

    it('clearAll clears both session and game state', async () => {
      sessionPersistenceService.saveSession(mockSession);
      localStorage.setItem('nexus-game-state', 'state');

      sessionPersistenceService.clearAll();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(localStorage.getItem('nexus-session')).toBeNull();
      expect(localStorage.getItem('nexus-game-state')).toBeNull();
    });
  });

  describe('Reconnection and Validation', () => {
    it('validates valid and invalid session payloads', () => {
      expect(sessionPersistenceService.validateSession(mockSession)).toBe(true);

      const invalid = { ...mockSession, userType: 'unknown' as unknown as 'player' };
      expect(sessionPersistenceService.validateSession(invalid)).toBe(false);
    });

    it('generates reconnection URL with query parameters', () => {
      sessionPersistenceService.saveSession(mockSession);

      const url = sessionPersistenceService.generateReconnectUrl('https://example.com/play');
      expect(url).toBe('https://example.com/play?reconnect=ABCD&userId=user-1&userType=host');
    });

    it('returns null reconnect URL if session is expired', () => {
      const expiredSession = {
        ...mockSession,
        lastActivity: Date.now() - (2 * 60 * 60 * 1000), // 2 hours
      };
      localStorage.setItem('nexus-session', JSON.stringify(expiredSession));

      const url = sessionPersistenceService.generateReconnectUrl('https://example.com/play');
      expect(url).toBeNull();
    });

    it('checks for reconnection from window.location.search', () => {
      window.history.pushState(
        {},
        '',
        '/app?reconnect=ROOM99&userId=u99&userType=player',
      );

      const historySpy = vi
        .spyOn(window.history, 'replaceState')
        .mockImplementation(() => {});

      const result = sessionPersistenceService.checkForReconnection();
      expect(result).toEqual({
        roomCode: 'ROOM99',
        userId: 'u99',
        userType: 'player',
      });
      expect(historySpy).toHaveBeenCalledWith({}, document.title, '/app');

      historySpy.mockRestore();
      window.history.pushState({}, '', '/');
    });

    it('returns comprehensive recovery data and stats', async () => {
      sessionPersistenceService.saveSession(mockSession);
      vi.mocked(dungeonMapIndexedDB.getGameState).mockResolvedValue(null);

      const recovery = await sessionPersistenceService.getRecoveryData();
      expect(recovery.isValid).toBe(true);
      expect(recovery.canReconnect).toBe(true);
      expect(recovery.session?.roomCode).toBe('ABCD');

      const stats = await sessionPersistenceService.getSessionStats();
      expect(stats.hasSession).toBe(true);
      expect(stats.canReconnect).toBe(true);
      expect(stats.hasSessionCookie).toBe(true);
    });
  });
});
