import React, { ReactNode } from 'react';
import { useNPCManagement } from '../hooks/useNPCManagement';
import { NPCContext } from './NPCContextObject';

interface NPCProviderProps {
  children: ReactNode;
}

export const NPCProvider: React.FC<NPCProviderProps> = ({ children }) => {
  const npcManagement = useNPCManagement();

  return <NPCContext.Provider value={npcManagement}>{children}</NPCContext.Provider>;
};