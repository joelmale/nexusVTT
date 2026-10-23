import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface PlayerViewContextValue {
  isPlayerView: boolean;
  setPlayerView: (active: boolean) => void;
  togglePlayerView: () => void;
}

export const PlayerViewContext = createContext<PlayerViewContextValue>({
  isPlayerView: false,
  setPlayerView: () => {},
  togglePlayerView: () => {},
});

export function PlayerViewProvider({
  children,
  initialActive = false,
}: {
  children: ReactNode;
  initialActive?: boolean;
}) {
  const [isPlayerView, setPlayerView] = useState(initialActive);

  const togglePlayerView = useCallback(() => {
    setPlayerView((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      isPlayerView,
      setPlayerView,
      togglePlayerView,
    }),
    [isPlayerView, togglePlayerView],
  );

  return (
    <PlayerViewContext.Provider value={value}>
      {children}
    </PlayerViewContext.Provider>
  );
}

/**
 * Hook to access and control the Player View preview state.
 */
export function usePlayerView(): PlayerViewContextValue {
  return useContext(PlayerViewContext);
}
