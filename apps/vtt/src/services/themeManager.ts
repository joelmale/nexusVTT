/**
 * Theme Manager - Optimized theme switching and CSS variable management
 *
 * Provides efficient theme switching with preloading and smooth transitions.
 */

// Extend Window interface for Google Analytics
declare global {
  interface Window {
    gtag?: (
      command: 'event',
      action: string,
      parameters: Record<string, string | number | boolean | undefined>,
    ) => void;
  }
}

import { applyColorScheme } from '../utils/colorSchemes';

export type ThemeType = 'glass' | 'solid';

interface ThemeConfig {
  className: string;
  variables: Record<string, string>;
}

/**
 * Theme configurations for efficient switching
 */
const THEME_CONFIGS: Record<ThemeType, ThemeConfig> = {
  glass: {
    className: '',
    variables: {
      // Glass theme uses default CSS variables
    },
  },
  solid: {
    className: 'solid-theme theme-solid',
    variables: {
      // Solid theme overrides are handled in CSS
    },
  },
};

/**
 * Current active theme
 */
let currentTheme: ThemeType | null = null;

/**
 * Preload theme styles for instant switching
 */
export async function preloadTheme(theme: ThemeType): Promise<void> {
  void theme;
  await Promise.resolve();
}

/**
 * Get current color scheme from store (lazy import to avoid circular dependencies)
 */
async function getCurrentColorScheme() {
  try {
    // Dynamic import to avoid circular dependency issues
    const { useGameStore } = await import('@/stores/gameStore');
    return useGameStore.getState().settings.colorScheme;
  } catch (error) {
    console.warn('Could not get current color scheme:', error);
    return null;
  }
}

/**
 * Switch theme with optimized performance
 */
export async function switchTheme(theme: ThemeType): Promise<void> {
  if (theme === currentTheme) return;

  const config = THEME_CONFIGS[theme];

  // Apply theme class to body
  // Remove any existing theme classes (both old 'theme-*' and new '*-theme' patterns)
  document.body.className = document.body.className
    .split(' ')
    .filter((cls) => !cls.startsWith('theme-') && !cls.endsWith('-theme'))
    .concat(config.className)
    .filter(Boolean)
    .join(' ');

  // Update CSS variables if needed
  if (config.variables) {
    const root = document.documentElement;
    Object.entries(config.variables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }

  // Reapply current color scheme to ensure theme variables are properly set
  const currentScheme = await getCurrentColorScheme();
  if (currentScheme) {
    applyColorScheme(currentScheme);
  }

  currentTheme = theme;

  // Dispatch theme change event for components that need to react
  window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));

  console.debug(`🎨 Theme switched to: ${theme}`);
}

/**
 * Get current theme
 */
export function getCurrentTheme(): ThemeType {
  return currentTheme || 'solid';
}

/**
 * Initialize theme based on user preferences
 */
export async function initializeTheme(): Promise<void> {
  // Check for saved theme preference
  const savedTheme = localStorage.getItem('nexus-theme') as ThemeType | null;

  // Default to solid theme for better performance
  const initialTheme = savedTheme || 'solid';

  await switchTheme(initialTheme);
}

/**
 * Save theme preference
 */
export function saveThemePreference(theme: ThemeType): void {
  localStorage.setItem('nexus-theme', theme);
}

/**
 * Theme-aware CSS variable getter
 * Returns the appropriate CSS variable value based on current theme
 */
export function getThemeVariable(variableName: string): string {
  const computedStyle = getComputedStyle(document.documentElement);
  return computedStyle.getPropertyValue(variableName).trim();
}

/**
 * Check if glassmorphism is enabled (inverse of solid theme)
 */
export function isGlassmorphismEnabled(): boolean {
  return currentTheme === 'glass';
}

/**
 * Performance monitoring for theme switches
 */
export function measureThemeSwitch(): () => void {
  const startTime = performance.now();

  return () => {
    const duration = performance.now() - startTime;
    console.debug(`⏱️ Theme switch took ${duration.toFixed(2)}ms`);

    // Report to analytics if available
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', 'theme_switch', {
        theme: currentTheme || 'solid',
        duration: Math.round(duration),
      });
    }
  };
}
