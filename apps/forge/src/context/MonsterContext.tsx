import React, { ReactNode } from 'react';
import { useMonsterManagement } from '../hooks/useMonsterManagement';
import { MonsterContext } from './MonsterContextObject';

interface MonsterProviderProps {
  children: ReactNode;
}

export const MonsterProvider: React.FC<MonsterProviderProps> = ({ children }) => {
  const monsterManagement = useMonsterManagement();

  return <MonsterContext.Provider value={monsterManagement}>{children}</MonsterContext.Provider>;
};
