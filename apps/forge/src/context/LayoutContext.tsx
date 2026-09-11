import React, { ReactNode, useState, createContext } from 'react';
import { LayoutMode } from '../components/CharacterSheet/AbilityScores';

export interface LayoutContextType {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

interface LayoutProviderProps {
  children: ReactNode;
}

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children }) => {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('classic-dnd');

  return (
    <LayoutContext.Provider value={{ layoutMode, setLayoutMode }}>
      {children}
    </LayoutContext.Provider>
  );
};