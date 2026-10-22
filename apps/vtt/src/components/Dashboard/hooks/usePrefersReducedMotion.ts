import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const getInitial = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? Boolean(window.matchMedia(QUERY)?.matches)
    : false;

/** True when the user asked the OS/browser to reduce motion. */
export const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(getInitial);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(QUERY);
    if (!mql) return undefined;
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
};
