import { useCallback } from 'react';
import { Character, Ability } from '../types/dnd';
import { updateCharacter } from '../services/dbService';
import { getModifier, AppSubclass } from '../services/dataService';
import { log } from '../utils/logger';

interface UseSpellcastingProps {
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  cantripModalState: { isOpen: boolean; characterId: string | null; characterClass: string | null };
  subclassModalState: { isOpen: boolean; characterId: string | null; characterClass: string | null };
  asiModalState: { isOpen: boolean; characterId: string | null };
  setCantripModalState: React.Dispatch<React.SetStateAction<{ isOpen: boolean; characterId: string | null; characterClass: string | null }>>;
  setSubclassModalState: React.Dispatch<React.SetStateAction<{ isOpen: boolean; characterId: string | null; characterClass: string | null }>>;
  setAsiModalState: React.Dispatch<React.SetStateAction<{ isOpen: boolean; characterId: string | null }>>;
}

export function useSpellcasting({
  characters,
  setCharacters,
  cantripModalState,
  subclassModalState,
  asiModalState,
  setCantripModalState,
  setSubclassModalState,
  setAsiModalState,
}: UseSpellcastingProps) {
  const selectCantrip = useCallback(async (cantripSlug: string) => {
    const { characterId } = cantripModalState;
    if (!characterId) return;

    const character = characters.find(c => c.id === characterId);
    if (!character || !character.spellcasting) return;

    const updatedCharacter = {
      ...character,
      spellcasting: {
        ...character.spellcasting,
        cantripsKnown: [...character.spellcasting.cantripsKnown, cantripSlug],
        cantripChoicesByLevel: {
          ...character.spellcasting.cantripChoicesByLevel,
          [character.level]: cantripSlug,
        },
      },
    };

    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === characterId ? updatedCharacter : c));
      setCantripModalState({ isOpen: false, characterId: null, characterClass: null });
    } catch (error) {
      log.error('Error selecting cantrip', { characterId, error });
      // TODO: Show user-friendly error notification
      // Consider adding: showError('Failed to select cantrip. Please try again.');
    }
  }, [characters, setCharacters, cantripModalState, setCantripModalState]);

  const selectSubclass = useCallback(async (subclass: AppSubclass) => {
    const { characterId } = subclassModalState;
    if (!characterId) return;

    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    const updatedCharacter = {
      ...character,
      subclass: subclass.slug,
    };

    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === characterId ? updatedCharacter : c));
      setSubclassModalState({ isOpen: false, characterId: null, characterClass: null });
    } catch (error) {
      log.error('Error selecting subclass', { characterId, error });
      // TODO: Show user-friendly error notification
      // Consider adding: showError('Failed to select subclass. Please try again.');
    }
  }, [characters, setCharacters, subclassModalState, setSubclassModalState]);

  const applyAsi = useCallback(async (increases: Partial<Record<Ability, number>>) => {
    const { characterId } = asiModalState;
    if (!characterId) return;

    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    const updatedAbilities = { ...character.abilities };
    for (const ability of Object.keys(increases) as Ability[]) {
      const increase = increases[ability] || 0;
      updatedAbilities[ability as keyof typeof updatedAbilities].score += increase;
      updatedAbilities[ability as keyof typeof updatedAbilities].modifier = getModifier(updatedAbilities[ability as keyof typeof updatedAbilities].score);
    }

    const updatedCharacter = {
      ...character,
      abilities: updatedAbilities,
    };

    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === characterId ? updatedCharacter : c));
      setAsiModalState({ isOpen: false, characterId: null });
    } catch (error) {
      log.error('Error applying ability score increase', { characterId, error });
      // TODO: Show user-friendly error notification
      // Consider adding: showError('Failed to apply ability score increase. Please try again.');
    }
  }, [characters, setCharacters, asiModalState, setAsiModalState]);

  return {
    selectCantrip,
    selectSubclass,
    applyAsi,
  };
}
