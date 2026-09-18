/**
 * Settings slice — user preference reads/writes plus their `nexus-settings`
 * localStorage mirror.
 *
 * Extracted verbatim from gameStore.ts. `settings` itself stays in the single
 * gameStore state object, so `useSettings()`, `useTheme()`, `useColorScheme()`
 * and every getState() read are unchanged. Settings are per-browser
 * preferences and are not part of buildGameStateProjection()'s canonical
 * snapshot.
 *
 * `updateSettings` still routes a `useMockData` flip through
 * `get().toggleMockData()` inside the same `set()` recipe, preserving the
 * original atomicity comment and behaviour.
 */

import { applyColorScheme } from '@/utils/colorSchemes';
import {
  initialState,
  saveSettingsToStorage,
} from '@/stores/game/initialState';
import type { GameStore, GameStoreGet, GameStoreSet } from '@/stores/game/types';

export type SettingsSlice = Pick<
  GameStore,
  | 'updateSettings'
  | 'setColorScheme'
  | 'setEnableGlassmorphism'
  | 'setPersistOpenPanels'
  | 'resetSettings'
>;

export const createSettingsSlice = (
  set: GameStoreSet,
  get: GameStoreGet,
): SettingsSlice => ({
  updateSettings: (settingsUpdate) => {
    set((state) => {
      const previousUseMockData = state.settings.useMockData;
      if (
        'useMockData' in settingsUpdate &&
        settingsUpdate.useMockData !== previousUseMockData
      ) {
        // Directly call the action within the same update to ensure atomicity
        get().toggleMockData(!!settingsUpdate.useMockData);
      }
      Object.assign(state.settings, settingsUpdate);
      saveSettingsToStorage(state.settings);
    });
  },

  setColorScheme: (colorScheme) => {
    set((state) => {
      state.settings.colorScheme = colorScheme;
      saveSettingsToStorage(state.settings);
    });
    // Apply the color scheme to CSS custom properties
    applyColorScheme(colorScheme);
  },

  setEnableGlassmorphism: (enabled) => {
    set((state) => {
      state.settings.enableGlassmorphism = enabled;
      saveSettingsToStorage(state.settings);
    });
  },
  setPersistOpenPanels: (enabled) => {
    set((state) => {
      state.settings.persistOpenPanels = enabled;
      saveSettingsToStorage(state.settings);
    });
  },

  resetSettings: () => {
    set((state) => {
      state.settings = initialState.settings;
    });
  },
});
