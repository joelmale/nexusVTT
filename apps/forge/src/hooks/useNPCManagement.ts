import { useState, useEffect, useMemo, useCallback } from 'react';
import { NPC } from '../types/dnd';
import { log } from '../utils/logger';
import {
  getAllNPCs,
  addNPC as addNPCDB,
  updateNPC as updateNPCDB,
  deleteNPC as deleteNPCDB,
} from '../services/dbService';
import { NPCFilters, DEFAULT_NPC_FILTERS } from '../context/NPCContextObject';

export const useNPCManagement = () => {
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [filters, setFiltersState] = useState<NPCFilters>(DEFAULT_NPC_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const allNpcs = await getAllNPCs();
        setNpcs(allNpcs);
      } catch (err) {
        log.error('NPC data load error', { error: err });
        setError(
          'Database upgrade needed. Please clear your browser cache or IndexedDB for this site and refresh.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Apply filters
  const filteredNPCs = useMemo(() => {
    let result = npcs;

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter((npc) =>
        npc.name.toLowerCase().includes(searchLower) ||
        npc.occupation.toLowerCase().includes(searchLower) ||
        npc.species.toLowerCase().includes(searchLower)
      );
    }

    // Species filter
    if (filters.species.length > 0) {
      result = result.filter((npc) => filters.species.includes(npc.species));
    }

    // Occupation filter
    if (filters.occupations.length > 0) {
      result = result.filter((npc) => filters.occupations.includes(npc.occupation));
    }

    // Alignment filter
    if (filters.alignments.length > 0) {
      result = result.filter((npc) => filters.alignments.includes(npc.alignment));
    }

    return result;
  }, [npcs, filters]);

  // CRUD operations
  const createNPC = useCallback(async (npc: NPC): Promise<boolean> => {
    try {
      await addNPCDB(npc);
      setNpcs((prev) => [...prev, npc]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create NPC');
      return false;
    }
  }, []);

  const updateNPC = useCallback(async (npc: NPC): Promise<boolean> => {
    try {
      await updateNPCDB(npc);
      setNpcs((prev) => prev.map((n) => (n.id === npc.id ? npc : n)));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update NPC');
      return false;
    }
  }, []);

  const deleteNPC = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteNPCDB(id);
      setNpcs((prev) => prev.filter((n) => n.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete NPC');
      return false;
    }
  }, []);

  // Filter management
  const setFilters = useCallback((newFilters: Partial<NPCFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_NPC_FILTERS);
  }, []);

  return {
    npcs,
    filteredNPCs,
    loading,
    error,
    createNPC,
    updateNPC,
    deleteNPC,
    filters,
    setFilters,
    clearFilters,
  };
};