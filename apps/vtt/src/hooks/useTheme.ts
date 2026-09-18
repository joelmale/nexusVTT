import { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { applyColorScheme, defaultColorSchemes } from '@/utils/colorSchemes';
import type { UserSettings } from '@/types/game';

export const THEME_ATTRIBUTE = 'data-theme';

export type ResolvedTheme = 'dark' | 'light';

/** Check whether system prefers light mode. */
export function prefersLightMode(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return Boolean(window.matchMedia('(prefers-color-scheme: light)')?.matches);
  } catch {
    return false;
  }
}

/**
 * Resolve 'auto' | 'dark' | 'light' into 'dark' | 'light'.
 */
export function resolveTheme(preference: unknown): ResolvedTheme {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return prefersLightMode() ? 'light' : 'dark';
}

/** Hook to read the currently active/resolved theme. */
export function useResolvedTheme(): ResolvedTheme {
  const themePreference = useGameStore((state) => state.settings?.theme ?? 'auto');
  const [systemIsLight, setSystemIsLight] = useState(prefersLightMode);

  useEffect(() => {
    if (themePreference !== 'auto') return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    let mql: MediaQueryList | undefined;
    try {
      mql = window.matchMedia('(prefers-color-scheme: light)');
    } catch {
      return;
    }
    if (!mql) return;

    const handler = (e: MediaQueryListEvent) => setSystemIsLight(e.matches);

    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else if ('addListener' in mql) {
      // Fallback for older browsers
      (mql as { addListener: (fn: (e: MediaQueryListEvent) => void) => void }).addListener(handler);
      return () =>
        (mql as { removeListener: (fn: (e: MediaQueryListEvent) => void) => void }).removeListener(handler);
    }
  }, [themePreference]);

  if (themePreference === 'light') return 'light';
  if (themePreference === 'dark') return 'dark';
  return systemIsLight ? 'light' : 'dark';
}

/**
 * Synchronize settings.theme onto document.documentElement[data-theme],
 * set document.documentElement.style.colorScheme,
 * and re-apply the active color scheme with the resolved theme mode.
 */
export function useThemeSync(): void {
  const themePreference = useGameStore(
    (state) => (state.settings?.theme ?? 'auto') as UserSettings['theme'],
  );
  const colorScheme = useGameStore(
    (state) => state.settings?.colorScheme ?? defaultColorSchemes[0],
  );
  const resolvedTheme = useResolvedTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTRIBUTE, resolvedTheme);
    root.style.colorScheme = resolvedTheme;

    // Apply color scheme adapted for this theme mode
    applyColorScheme(colorScheme, resolvedTheme);

    // Notify any non-React or decoupled listeners
    window.dispatchEvent(
      new CustomEvent('themeChanged', { detail: { theme: resolvedTheme } }),
    );
  }, [themePreference, resolvedTheme, colorScheme]);
}
