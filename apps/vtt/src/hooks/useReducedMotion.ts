import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';

const REDUCED_MOTION_ATTRIBUTE = 'data-reduced-motion';

/**
 * Mirror `settings.reducedMotion` onto `<html>` so CSS can honour it.
 *
 * The setting has existed in `UserSettings` and in the Settings UI for a while
 * but nothing consumed it - only the OS-level
 * `@media (prefers-reduced-motion: reduce)` block in styles/reset.css had any
 * effect. This is the consumer; reset.css matches the attribute alongside the
 * media query.
 */
export function useReducedMotionSync(): void {
  const reducedMotion = useGameStore((state) => state.settings.reducedMotion);

  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) {
      root.setAttribute(REDUCED_MOTION_ATTRIBUTE, 'true');
    } else {
      root.removeAttribute(REDUCED_MOTION_ATTRIBUTE);
    }
  }, [reducedMotion]);
}

/** OS preference OR the in-app setting, for JS consumers. */
export function prefersReducedMotion(): boolean {
  const osPreference =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  return osPreference || useGameStore.getState().settings.reducedMotion;
}
