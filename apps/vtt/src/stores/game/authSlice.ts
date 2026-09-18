/**
 * Auth slice — the `/auth/me` session probe and the login/logout transitions
 * around it.
 *
 * Extracted verbatim from gameStore.ts. `user`, `isAuthenticated` and
 * `authChecked` stay in the single gameStore state object, so `useUser()`,
 * route guards reading `authChecked` and every getState() read are unchanged.
 *
 * `authChecked` is still set in `checkAuth`'s `finally`, so guards can keep
 * distinguishing "auth still loading" from "confirmed signed out" on both the
 * success and failure paths.
 */

import { initialState } from '@/stores/game/initialState';
import type { GameStore, GameStoreGet, GameStoreSet } from '@/stores/game/types';

export type AuthSlice = Pick<
  GameStore,
  | 'login'
  | 'logout'
  | 'checkAuth'
>;

export const createAuthSlice = (
  set: GameStoreSet,
  get: GameStoreGet,
): AuthSlice => ({
  login: (user) => {
    set((state) => {
      state.user = {
        ...state.user,
        ...user,
        type: user.type || state.user.type || 'player',
        connected: true,
        color: state.user.color || 'blue',
      };
      state.isAuthenticated = true;
    });
  },
  logout: async () => {
    await fetch('/auth/logout', {
      credentials: 'include',
    });
    set({ user: initialState.user, isAuthenticated: false });
  },
  checkAuth: async () => {
    try {
      const response = await fetch('/auth/me', {
        credentials: 'include',
      });
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const profile = await response.json();
          get().login({
            ...profile,
            name: profile.displayName || profile.name,
            displayName: profile.displayName || profile.name,
          });
        } else {
          console.warn('Auth check returned non-JSON response');
          set({ isAuthenticated: false });
        }
      } else {
        set({ isAuthenticated: false });
      }
    } catch (error) {
      console.error('Auth check failed', error);
      set({ isAuthenticated: false });
    } finally {
      // Mark the initial auth probe as complete so route guards can stop
      // waiting and make a decision based on the real result.
      set({ authChecked: true });
    }
  },
});
