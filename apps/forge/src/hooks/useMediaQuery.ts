/**
 * useMediaQuery Hook
 *
 * Custom hook to abstract window resize event listener logic from UI components.
 * Provides a clean API for responsive design without manual event listener management.
 *
 * Benefits:
 * - Abstracts window.matchMedia API
 * - Handles event listener cleanup automatically
 * - Prevents memory leaks from orphaned listeners
 * - Reusable across components
 * - SSR-safe (returns false during server-side rendering)
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 * const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
 */

import { useState, useEffect } from 'react';

/**
 * Hook to detect media query matches
 *
 * @param query - CSS media query string (e.g., '(max-width: 768px)')
 * @returns boolean indicating if the media query currently matches
 */
export function useMediaQuery(query: string): boolean {
  // SSR-safe: return false during server-side rendering
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    // Skip if window is not available (SSR)
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);

    // Handler for media query changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add event listener (modern browsers)
    // Initial value is already set via lazy state initialization
    // Note: Some older browsers use addListener instead of addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
}

/**
 * Hook to detect mobile devices (screen width < 1024px)
 *
 * Convenience wrapper around useMediaQuery for common use case.
 *
 * @returns boolean indicating if the device is mobile
 *
 * @example
 * const isMobile = useIsMobile();
 * return isMobile ? <MobileLayout /> : <DesktopLayout />;
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}

/**
 * Hook to detect tablet devices (768px <= width < 1024px)
 *
 * @returns boolean indicating if the device is a tablet
 */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

/**
 * Hook to detect desktop devices (screen width >= 1024px)
 *
 * @returns boolean indicating if the device is desktop
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

/**
 * Hook to detect user's color scheme preference
 *
 * @returns 'dark' | 'light' | null
 */
export function usePreferredColorScheme(): 'dark' | 'light' | null {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const prefersLight = useMediaQuery('(prefers-color-scheme: light)');

  if (prefersDark) return 'dark';
  if (prefersLight) return 'light';
  return null;
}
