import { createContext } from 'react';
import { Character } from '../types/dnd';

interface CharacterContextType {
  characters: Character[];
  loading: boolean;
  error: string | null;
  loadCharacters: () => Promise<void>;
  createCharacter: (character: Character) => Promise<boolean>;
  removeCharacter: (id: string) => Promise<boolean>;
  updateCharacter: (character: Character) => Promise<boolean>;
}

export const CharacterContext = createContext<CharacterContextType | undefined>(undefined);