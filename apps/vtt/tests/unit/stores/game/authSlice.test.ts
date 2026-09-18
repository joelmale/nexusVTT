import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthSlice } from '@/stores/game/authSlice';
import { initialState } from '@/stores/game/initialState';
import type { GameStoreGet, GameStoreSet } from '@/stores/game/types';

interface MockAuthState {
  user: {
    id: string;
    name: string;
    color: string;
    avatar?: string;
  };
  isAuthenticated: boolean;
  authChecked: boolean;
  login?: (user: { name?: string; id?: string }) => void;
  [key: string]: unknown;
}

describe('authSlice', () => {
  let state: MockAuthState;
  let get: GameStoreGet;
  let set: GameStoreSet;

  beforeEach(() => {
    state = {
      ...initialState,
      user: { ...initialState.user },
      isAuthenticated: false,
      authChecked: false,
    };

    get = vi.fn(() => state) as unknown as GameStoreGet;
    set = vi.fn((updater) => {
      if (typeof updater === 'function') {
        updater(state);
      } else {
        Object.assign(state, updater);
      }
    }) as unknown as GameStoreSet;
  });

  describe('login', () => {
    it('sets user name and marks authenticated with defaults', () => {
      const slice = createAuthSlice(set, get);
      state.login = slice.login;

      slice.login({ name: 'Gandalf' });

      expect(state.user.name).toBe('Gandalf');
      expect(state.isAuthenticated).toBe(true);
      expect(state.user.id).toBeDefined();
      expect(state.user.color).toBeDefined();
    });

    it('preserves existing user color if already set', () => {
      state.user.color = '#ff0000';
      const slice = createAuthSlice(set, get);
      state.login = slice.login;

      slice.login({ name: 'Legolas' });

      expect(state.user.name).toBe('Legolas');
      expect(state.user.color).toBe('#ff0000');
    });
  });

  describe('logout', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });
    });

    it('resets user to initial state and sets isAuthenticated to false', async () => {
      state.user = { id: 'u-123', name: 'Gimli', color: '#123456' };
      state.isAuthenticated = true;

      const slice = createAuthSlice(set, get);
      await slice.logout();

      expect(state.user.name).toBe(initialState.user.name);
      expect(state.isAuthenticated).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith('/auth/logout', {
        credentials: 'include',
      });

      global.fetch = originalFetch;
    });
  });

  describe('checkAuth', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('verifies session and updates state when user is authenticated', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: 'auth-user-1',
          name: 'Frodo',
          avatar: 'http://avatar.url',
        }),
      });

      const slice = createAuthSlice(set, get);
      state.login = slice.login;

      await slice.checkAuth();

      expect(state.isAuthenticated).toBe(true);
      expect(state.authChecked).toBe(true);
      expect(state.user.id).toBe('auth-user-1');
      expect(state.user.name).toBe('Frodo');

      global.fetch = originalFetch;
    });

    it('sets authChecked to true when user is unauthenticated', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Unauthorized' }),
      });

      const slice = createAuthSlice(set, get);
      await slice.checkAuth();

      expect(state.isAuthenticated).toBe(false);
      expect(state.authChecked).toBe(true);

      global.fetch = originalFetch;
    });

    it('falls back gracefully when response is not application/json', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html>Not JSON</html>',
      });

      const slice = createAuthSlice(set, get);
      await slice.checkAuth();

      expect(state.isAuthenticated).toBe(false);
      expect(state.authChecked).toBe(true);

      global.fetch = originalFetch;
    });

    it('handles network failure without throwing and sets authChecked', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const slice = createAuthSlice(set, get);
      await slice.checkAuth();

      expect(state.isAuthenticated).toBe(false);
      expect(state.authChecked).toBe(true);

      global.fetch = originalFetch;
    });
  });
});
