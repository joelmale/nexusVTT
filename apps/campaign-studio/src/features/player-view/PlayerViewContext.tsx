import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { PlayerViewContext } from './playerViewState';

const STORAGE_KEY = 'nexus.campaign-studio.player-view';

function getStoredPlayerView(fallback: boolean): boolean {
  if (fallback) return true;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === 'true';
  } catch {
    // SessionStorage may not be available in all test or browser environments
  }
  return fallback;
}

export function PlayerViewProvider({
  children,
  initialActive = false,
}: {
  children: ReactNode;
  initialActive?: boolean;
}) {
  const [isPlayerView, setPlayerViewInternal] = useState(() =>
    getStoredPlayerView(initialActive),
  );

  const setPlayerView = useCallback((active: boolean) => {
    setPlayerViewInternal(active);
    try {
      sessionStorage.setItem(STORAGE_KEY, String(active));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const togglePlayerView = useCallback(() => {
    setPlayerViewInternal((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      isPlayerView,
      setPlayerView,
      togglePlayerView,
    }),
    [isPlayerView, setPlayerView, togglePlayerView],
  );

  return (
    <PlayerViewContext.Provider value={value}>
      {children}
    </PlayerViewContext.Provider>
  );
}
