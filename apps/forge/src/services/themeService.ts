/**
 * Theme Service
 * Handles localStorage persistence for theme preferences
 */
import { log } from '../utils/logger';

export type ThemeType = 'dark-colorful' | 'light' | 'paper';

const THEME_STORAGE_KEY = '5e-forge-theme';
const DEFAULT_THEME: ThemeType = 'dark-colorful';

/**
 * Load theme preference from localStorage
 */
export const loadTheme = (): ThemeType => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && isValidTheme(stored)) {
      return stored as ThemeType;
    }
  } catch (error) {
    log.warn('Failed to load theme from localStorage', { error });
  }
  return DEFAULT_THEME;
};

/**
 * Save theme preference to localStorage
 */
export const saveTheme = (theme: ThemeType): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    log.warn('Failed to save theme to localStorage', { error, theme });
  }
};

/**
 * Remove theme preference from localStorage
 */
export const clearTheme = (): void => {
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch (error) {
    log.warn('Failed to clear theme from localStorage', { error });
  }
};

/**
 * Validate theme string
 */
const isValidTheme = (theme: string): boolean => {
  return theme === 'dark-colorful' || theme === 'light' || theme === 'paper';
};

/**
 * Apply theme to document element
 */
export const applyTheme = (theme: ThemeType): void => {
  document.documentElement.setAttribute('data-theme', theme);
};

/**
 * Get theme display name
 */
export const getThemeDisplayName = (theme: ThemeType): string => {
  switch (theme) {
    case 'dark-colorful':
      return 'Dark Colorful';
    case 'light':
      return 'Light Mode';
    case 'paper':
      return 'Paper Mode';
  }
};

/**
 * Get theme description
 */
export const getThemeDescription = (theme: ThemeType): string => {
  switch (theme) {
    case 'dark-colorful':
      return 'Current default theme';
    case 'light':
      return 'Clean and bright';
    case 'paper':
      return 'Classic parchment feel';
  }
};
