import { useState, useCallback, useEffect } from 'react';
import { InitiativeEntry, PlayerEntry, CombatState } from '../../../types/encounterCombat';
import { useMonsterContext } from '../../../hooks';
import { getEncounter } from '../../../services/dbService';
import { log } from '../../../utils/logger';

interface UseEncounterCombatProps {
  encounterId: string;
  initialCombatState?: CombatState;
}

interface UseEncounterCombatReturn {
  combatState: CombatState;
  players: PlayerEntry[];
  initiativeOrder: InitiativeEntry[];
  currentTurn: number;
  round: number;
  isCombatActive: boolean;
  isLoadingEncounter: boolean;
  addPlayers: (players: PlayerEntry[]) => void;
  removePlayer: (characterId: string) => void;
  updatePlayer: (characterId: string, updates: Partial<PlayerEntry>) => void;
  updateInitiativeEntry: (entryId: string, updates: Partial<InitiativeEntry>) => void;
  reorderInitiative: (fromIndex: number, toIndex: number) => void;
  nextTurn: () => void;
  previousTurn: () => void;
  newRound: () => void;
  saveCombatState: () => void;
  loadCombatState: () => CombatState | null;
  resetCombat: () => void;
}

const STORAGE_KEY_PREFIX = 'encounter_combat_';

const loadCombatState = (id: string): CombatState | null => {
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    // Swallow parse errors and reset state cleanly
    void error;
    return null;
  }
};

export function useEncounterCombat({
  encounterId,
  initialCombatState
}: UseEncounterCombatProps): UseEncounterCombatReturn {
  const { allMonsters } = useMonsterContext();

  const [combatState, setCombatState] = useState<CombatState>(() => {
    if (initialCombatState) {
      return initialCombatState;
    }
    // Try to load from localStorage
    const saved = loadCombatState(encounterId);
    return saved || {
      round: 1,
      currentTurn: 0,
      initiativeOrder: [],
      players: [],
    };
  });

  const [isLoadingEncounter, setIsLoadingEncounter] = useState(false);

  // Load encounter data when encounterId changes
  useEffect(() => {
    let isCancelled = false;

    if (!encounterId || encounterId === 'current-encounter') {
      return undefined;
    }

  const loadEncounter = async () => {
      setTimeout(() => {
        if (!isCancelled) {
          setIsLoadingEncounter(true);
        }
      }, 0);

      try {
        const encounter = await getEncounter(encounterId);
        if (!encounter || isCancelled) {
          return;
        }

        // Convert encounter monsters to initiative entries
        const initiativeEntries: InitiativeEntry[] = [];
        const monsterCount = new Map<string, number>();

        encounter.monsterIds.forEach((monsterId) => {
          monsterCount.set(monsterId, (monsterCount.get(monsterId) || 0) + 1);
        });

        monsterCount.forEach((count, monsterId) => {
          const monster = allMonsters.find((m) => m.index === monsterId);
          if (monster) {
            for (let i = 0; i < count; i++) {
              const instanceId = count > 1 ? String.fromCharCode(65 + i) : undefined; // A, B, C...
              initiativeEntries.push({
                id: `${monsterId}_${instanceId || 'single'}`,
                name: instanceId ? `${monster.name} ${instanceId}` : monster.name,
                type: 'monster',
                initiative: 0, // Will be set by user
                instanceId,
                conditions: [],
                currentHp: monster.hit_points,
                maxHp: monster.hit_points,
                isActive: false,
              });
            }
          }
        });

        setCombatState(prev => ({
          ...prev,
          initiativeOrder: initiativeEntries,
        }));
      } catch (error) {
        log.error('Failed to load encounter', { encounterId, error });
      } finally {
        if (!isCancelled) {
          setIsLoadingEncounter(false);
        }
      }
    };

    loadEncounter();

    return () => {
      isCancelled = true;
    };
  }, [encounterId, allMonsters]);

  const storageKey = `${STORAGE_KEY_PREFIX}${encounterId}`;

  const saveCombatState = useCallback(() => {
    const stateToSave = {
      ...combatState,
      savedAt: Date.now(),
    };
    localStorage.setItem(storageKey, JSON.stringify(stateToSave));
  }, [combatState, storageKey]);

  const addPlayers = useCallback((newPlayers: PlayerEntry[]) => {
    setCombatState(prev => ({
      ...prev,
      players: [...prev.players, ...newPlayers],
      // Add to initiative order if not already present
      initiativeOrder: [
        ...prev.initiativeOrder,
        ...newPlayers.map(player => ({
          id: player.characterId,
          name: player.name,
          type: 'player' as const,
          initiative: player.initiative,
          instanceId: undefined,
          conditions: player.conditions,
          currentHp: player.currentHp,
          maxHp: player.maxHp,
          isActive: false,
          notes: undefined,
        }))
      ].sort((a, b) => b.initiative - a.initiative), // Sort by initiative descending
    }));
  }, []);

  const removePlayer = useCallback((characterId: string) => {
    setCombatState(prev => ({
      ...prev,
      players: prev.players.filter(p => p.characterId !== characterId),
      initiativeOrder: prev.initiativeOrder.filter(entry => entry.id !== characterId),
    }));
  }, []);

  const updatePlayer = useCallback((characterId: string, updates: Partial<PlayerEntry>) => {
    setCombatState(prev => ({
      ...prev,
      players: prev.players.map(p =>
        p.characterId === characterId ? { ...p, ...updates } : p
      ),
      initiativeOrder: prev.initiativeOrder.map(entry =>
        entry.id === characterId ? { ...entry, ...updates } : entry
      ),
    }));
  }, []);

  const updateInitiativeEntry = useCallback((entryId: string, updates: Partial<InitiativeEntry>) => {
    setCombatState(prev => ({
      ...prev,
      initiativeOrder: prev.initiativeOrder.map(entry =>
        entry.id === entryId ? { ...entry, ...updates } : entry
      ),
    }));
  }, []);

  const reorderInitiative = useCallback((fromIndex: number, toIndex: number) => {
    setCombatState(prev => {
      if (prev.initiativeOrder.length === 0 || fromIndex === toIndex) {
        return prev;
      }

      const newOrder = [...prev.initiativeOrder];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);

      // Keep the current combatant active after the reorder
      const activeId = prev.initiativeOrder[prev.currentTurn]?.id;
      const newCurrentTurn = activeId ? newOrder.findIndex(entry => entry.id === activeId) : 0;

      return {
        ...prev,
        initiativeOrder: newOrder.map((entry, index) => ({
          ...entry,
          isActive: index === newCurrentTurn,
        })),
        currentTurn: Math.max(0, newCurrentTurn),
      };
    });
  }, []);

  const nextTurn = useCallback(() => {
    setCombatState(prev => {
      if (prev.initiativeOrder.length === 0) {
        return prev;
      }

      const nextTurn = (prev.currentTurn + 1) % prev.initiativeOrder.length;
      const newRound = nextTurn === 0 ? prev.round + 1 : prev.round;

      return {
        ...prev,
        currentTurn: nextTurn,
        round: newRound,
        initiativeOrder: prev.initiativeOrder.map((entry, index) => ({
          ...entry,
          isActive: index === nextTurn,
        })),
      };
    });
  }, []);

  const previousTurn = useCallback(() => {
    setCombatState(prev => {
      if (prev.initiativeOrder.length === 0) {
        return prev;
      }

      const prevTurn = prev.currentTurn === 0
        ? prev.initiativeOrder.length - 1
        : prev.currentTurn - 1;
      const newRound = prev.currentTurn === 0 ? Math.max(1, prev.round - 1) : prev.round;

      return {
        ...prev,
        currentTurn: prevTurn,
        round: newRound,
        initiativeOrder: prev.initiativeOrder.map((entry, index) => ({
          ...entry,
          isActive: index === prevTurn,
        })),
      };
    });
  }, []);

  const newRound = useCallback(() => {
    setCombatState(prev => ({
      ...prev,
      round: prev.round + 1,
      currentTurn: 0,
      initiativeOrder: prev.initiativeOrder.map((entry, index) => ({
        ...entry,
        isActive: index === 0,
      })),
    }));
  }, []);

  const resetCombat = useCallback(() => {
    setCombatState({
      round: 1,
      currentTurn: 0,
      initiativeOrder: [],
      players: [],
    });
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  // Auto-save on state changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(saveCombatState, 1000);
    return () => clearTimeout(timeoutId);
  }, [combatState, saveCombatState]);

  return {
    combatState,
    players: combatState.players,
    initiativeOrder: combatState.initiativeOrder,
    currentTurn: combatState.currentTurn,
    round: combatState.round,
    isCombatActive: combatState.initiativeOrder.length > 0,
    isLoadingEncounter,
    addPlayers,
    removePlayer,
    updatePlayer,
    updateInitiativeEntry,
    nextTurn,
    previousTurn,
    reorderInitiative,
    newRound,
    saveCombatState,
    loadCombatState: () => loadCombatState(encounterId),
    resetCombat,
  };
}
