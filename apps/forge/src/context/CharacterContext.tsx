import React, { ReactNode, useMemo } from 'react';
import { useCharacterManagement } from '../hooks';
import { CharacterContext } from './CharacterContextObject';

// useCharacterContext hook moved to separate file to fix React refresh warning

interface CharacterProviderProps {
  children: ReactNode;
}

export const CharacterProvider: React.FC<CharacterProviderProps> = ({ children }) => {
  const characterManagement = useCharacterManagement();

  // Additional memoization for extra safety
  // While useCharacterManagement already returns a memoized object,
  // this ensures the context value reference stays stable
  const contextValue = useMemo(() => characterManagement, [characterManagement]);

  return (
    <CharacterContext.Provider value={contextValue}>
      {children}
    </CharacterContext.Provider>
  );
};