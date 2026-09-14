import { useContext } from 'react';
import { MonsterContext } from '../context/MonsterContextObject';

export const useMonsterContext = () => {
  const context = useContext(MonsterContext);
  if (context === undefined) {
    throw new Error('useMonsterContext must be used within a MonsterProvider');
  }
  return context;
};
