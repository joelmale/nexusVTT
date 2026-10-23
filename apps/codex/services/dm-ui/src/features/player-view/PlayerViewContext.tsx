import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { PlayerViewContext } from './playerViewState';

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
