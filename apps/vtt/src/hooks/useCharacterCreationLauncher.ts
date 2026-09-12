import { useContext } from 'react';
import { CharacterCreationContext } from '@/components/CharacterCreationContext';

export const useCharacterCreationLauncher = () => {
  const context = useContext(CharacterCreationContext);
  if (!context) {
    throw new Error(
      'useCharacterCreationLauncher must be used within a CharacterCreationProvider',
    );
  }
  return context;
};
