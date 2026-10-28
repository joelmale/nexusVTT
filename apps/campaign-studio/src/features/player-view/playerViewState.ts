import { createContext, useContext } from 'react';

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

/**
 * Hook to access and control the Player View preview state.
 */
export function usePlayerView(): PlayerViewContextValue {
  return useContext(PlayerViewContext);
}
