import React from 'react';
import type { Character } from '@/types/character';

// Context for sharing character creation launcher across components
export interface CharacterCreationContextType {
  startCharacterCreation: (
    playerId: string,
    context: 'fullpage' | 'modal',
    onComplete: (characterId: string, character?: Character) => void,
    onCancel?: () => void,
  ) => void;
  LauncherComponent: React.ReactNode;
  isActive: boolean;
}

export const CharacterCreationContext =
  React.createContext<CharacterCreationContextType | null>(null);