import { useState, useEffect, useMemo, useCallback } from 'react';
import { Monster, UserMonster, Encounter } from '../types/dnd';
import { MONSTER_DATABASE } from '../services/dataService';
import { log } from '../utils/logger';
import {
  getAllCustomMonsters,
  addCustomMonster,
  updateCustomMonster as updateCustomMonsterDB,
  deleteCustomMonster as deleteCustomMonsterDB,
  getFavoriteMonsters,
  addFavorite,
  removeFavorite,
  getAllEncounters,
  saveEncounter as saveEncounterDB,
  deleteEncounter,
  getEncounter,
} from '../services/dbService';
import { MonsterFilters, EncounterMonsterSelection } from '../context/MonsterContextObject';

const DEFAULT_FILTERS: MonsterFilters = {
  search: '',
  types: [],
  sizes: [],
  crMin: 0,
  crMax: 30,
  hasLegendaryActions: null,
  showFavoritesOnly: false,
  showCustomOnly: false,
  showSRDOnly: false,
};

export const useMonsterManagement = () => {
  const [srdMonsters] = useState<Monster[]>(MONSTER_DATABASE);
  const [customMonsters, setCustomMonsters] = useState<UserMonster[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selectedEncounterMonsters, setSelectedEncounterMonsters] = useState<EncounterMonsterSelection>({});
  const [encounterViewMode, setEncounterViewMode] = useState<'grid' | 'tabs'>('grid');
  const [filters, setFiltersState] = useState<MonsterFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [custom, favorites, allEncounters] = await Promise.all([
          getAllCustomMonsters().catch(() => []),
          getFavoriteMonsters().catch(() => []),
          getAllEncounters().catch(() => []),
        ]);

        setCustomMonsters(custom);
        setFavoriteIds(favorites);
        setEncounters(allEncounters);
      } catch (err) {
        log.error('Monster data load error', { error: err });
        setError(
          'Database upgrade needed. Please clear your browser cache or IndexedDB for this site and refresh.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Combine SRD and custom monsters
  const allMonsters = useMemo<(Monster | UserMonster)[]>(() => {
    return [...srdMonsters, ...customMonsters];
  }, [srdMonsters, customMonsters]);

  // Apply filters
  const filteredMonsters = useMemo(() => {
    let result = allMonsters;

    // Search filter (debounced in component)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter((m) => m.name.toLowerCase().includes(searchLower));
    }

    // Type filter
    if (filters.types.length > 0) {
      result = result.filter((m) => filters.types.includes(m.type));
    }

    // Size filter
    if (filters.sizes.length > 0) {
      result = result.filter((m) => filters.sizes.includes(m.size));
    }

    // CR range filter
    result = result.filter(
      (m) => m.challenge_rating >= filters.crMin && m.challenge_rating <= filters.crMax
    );

    // Has legendary actions filter
    if (filters.hasLegendaryActions !== null) {
      result = result.filter((m) => {
        const hasLegendary = !!m.legendary_actions && m.legendary_actions.length > 0;
        return hasLegendary === filters.hasLegendaryActions;
      });
    }

    // Favorites only
    if (filters.showFavoritesOnly) {
      result = result.filter((m) => favoriteIds.includes(m.index));
    }

    // Custom only
    if (filters.showCustomOnly) {
      result = result.filter((m) => 'isCustom' in m && m.isCustom);
    }

    // SRD only
    if (filters.showSRDOnly) {
      result = result.filter((m) => !('isCustom' in m));
    }

    return result;
  }, [allMonsters, filters, favoriteIds]);

  // Favorites
  const toggleFavorite = useCallback(
    async (monsterId: string) => {
      try {
        const isFav = favoriteIds.includes(monsterId);
        if (isFav) {
          await removeFavorite(monsterId);
          setFavoriteIds((prev) => prev.filter((id) => id !== monsterId));
        } else {
          await addFavorite(monsterId);
          setFavoriteIds((prev) => [...prev, monsterId]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to toggle favorite');
      }
    },
    [favoriteIds]
  );

  const isFavorited = useCallback(
    (monsterId: string) => favoriteIds.includes(monsterId),
    [favoriteIds]
  );

  // Custom monsters
  const createCustomMonster = useCallback(async (monster: UserMonster): Promise<boolean> => {
    try {
      await addCustomMonster(monster);
      setCustomMonsters((prev) => [...prev, monster]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create custom monster');
      return false;
    }
  }, []);

  const updateCustomMonster = useCallback(async (monster: UserMonster): Promise<boolean> => {
    try {
      await updateCustomMonsterDB(monster);
      setCustomMonsters((prev) => prev.map((m) => (m.id === monster.id ? monster : m)));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update custom monster');
      return false;
    }
  }, []);

  const deleteCustomMonster = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteCustomMonsterDB(id);
      setCustomMonsters((prev) => prev.filter((m) => m.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete custom monster');
      return false;
    }
  }, []);

  // Encounter selection
  const toggleMonsterSelection = useCallback((monsterId: string) => {
    setSelectedEncounterMonsters((prev) => {
      if (prev[monsterId]) {
        // Remove monster from selection
        const newSelection = { ...prev };
        delete newSelection[monsterId];
        return newSelection;
      } else {
        // Add monster with quantity of 1
        return { ...prev, [monsterId]: 1 };
      }
    });
  }, []);

  const setMonsterQuantity = useCallback((monsterId: string, quantity: number) => {
    setSelectedEncounterMonsters((prev) => {
      if (quantity <= 0) {
        // Remove monster if quantity is 0 or less
        const newSelection = { ...prev };
        delete newSelection[monsterId];
        return newSelection;
      } else {
        // Update quantity
        return { ...prev, [monsterId]: quantity };
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedEncounterMonsters({});
  }, []);

  // Encounter management
  const saveEncounterFunc = useCallback(
    async (name: string): Promise<boolean> => {
      try {
        // Validate input
        if (!name.trim()) {
          throw new Error('Encounter name is required');
        }

        if (Object.keys(selectedEncounterMonsters).length === 0) {
          throw new Error('No monsters selected for encounter');
        }

        // Convert selectedEncounterMonsters object to array with duplicates for quantity
        const monsterIds: string[] = [];
        Object.entries(selectedEncounterMonsters).forEach(([monsterId, quantity]) => {
          for (let i = 0; i < quantity; i++) {
            monsterIds.push(monsterId);
          }
        });

        // Validate that all monster IDs exist in our monster database
        const invalidIds = monsterIds.filter(id => !allMonsters.some(monster => monster.index === id));
        if (invalidIds.length > 0) {
          throw new Error(`Invalid monster IDs found: ${invalidIds.join(', ')}`);
        }

        const encounter: Encounter = {
          id: crypto.randomUUID(),
          name: name.trim(),
          monsterIds,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await saveEncounterDB(encounter);
        setEncounters((prev) => [...prev, encounter]);
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save encounter';
        setError(errorMessage);
        log.error('Encounter save failed', { error: err, name });
        return false;
      }
    },
    [selectedEncounterMonsters, allMonsters]
  );

  const loadEncounter = useCallback(async (id: string): Promise<void> => {
    try {
      const encounter = await getEncounter(id);
      if (encounter) {
        // Convert array to object with quantities
        const monsterQuantities: EncounterMonsterSelection = {};
        encounter.monsterIds.forEach((monsterId) => {
          monsterQuantities[monsterId] = (monsterQuantities[monsterId] || 0) + 1;
        });
        setSelectedEncounterMonsters(monsterQuantities);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load encounter');
    }
  }, []);

  const deleteEncounterById = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteEncounter(id);
      setEncounters((prev) => prev.filter((e) => e.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete encounter');
      return false;
    }
  }, []);

  // Filter management
  const setFilters = useCallback((newFilters: Partial<MonsterFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  return {
    srdMonsters,
    customMonsters,
    allMonsters,
    filteredMonsters,
    favoriteIds,
    toggleFavorite,
    isFavorited,
    createCustomMonster,
    updateCustomMonster,
    deleteCustomMonster,
    encounters,
    selectedEncounterMonsters,
    encounterViewMode,
    toggleMonsterSelection,
    setMonsterQuantity,
    clearSelection,
    setEncounterViewMode,
    saveEncounter: saveEncounterFunc,
    loadEncounter,
    deleteEncounterById,
    filters,
    setFilters,
    clearFilters,
    loading,
    error,
  };
};
