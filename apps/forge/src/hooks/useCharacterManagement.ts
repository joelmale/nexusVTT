import { useState, useEffect, useCallback, useMemo } from 'react';
import { Character } from '../types/dnd';
import { getAllCharacters, addCharacter, deleteCharacter, updateCharacter } from '../services/dbService';
import { refreshCharacterResources } from '../services/characterService';

export function useCharacterManagement() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCharacters = useCallback(async () => {
    try {
      setLoading(true);
      const chars = await getAllCharacters();
      // Ensure all characters have up-to-date resources
      const updatedChars = chars.map(character => refreshCharacterResources(character));
      setCharacters(updatedChars);
      setError(null);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load characters';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const createCharacter = useCallback(async (character: Character) => {
    try {
      await addCharacter(character);
      await loadCharacters(); // Refresh the list
      return true;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to create character';
      setError(errorMessage);
      return false;
    }
  }, [loadCharacters]);

  const removeCharacter = useCallback(async (id: string) => {
    try {
      await deleteCharacter(id);
      setCharacters(prev => prev.filter(c => c.id !== id));
      return true;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to delete character';
      setError(errorMessage);
      return false;
    }
  }, []);

  const updateCharacterData = useCallback(async (updatedCharacter: Character) => {
    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === updatedCharacter.id ? updatedCharacter : c));
      return true;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to update character';
      setError(errorMessage);
      return false;
    }
  }, []);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  // Memoize the returned object to prevent unnecessary re-renders
  // of components consuming this context
  return useMemo(
    () => ({
      characters,
      loading,
      error,
      loadCharacters,
      createCharacter,
      removeCharacter,
      updateCharacter: updateCharacterData,
    }),
    [characters, loading, error, loadCharacters, createCharacter, removeCharacter, updateCharacterData]
  );
}