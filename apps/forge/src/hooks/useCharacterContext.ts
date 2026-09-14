import { useContext } from 'react';
import { CharacterContext } from '../context/CharacterContextObject';

export const useCharacterContext = () => {
  const context = useContext(CharacterContext);
  if (context === undefined) {
    throw new Error('useCharacterContext must be used within a CharacterProvider');
  }
  return context;
};