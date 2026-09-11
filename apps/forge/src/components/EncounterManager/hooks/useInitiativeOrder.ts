import { useState, useCallback } from 'react';
import { InitiativeEntry } from '../../../types/encounterCombat';

interface UseInitiativeOrderProps {
  initialOrder?: InitiativeEntry[];
}

interface UseInitiativeOrderReturn {
  initiativeOrder: InitiativeEntry[];
  setInitiativeOrder: (order: InitiativeEntry[]) => void;
  reorderInitiative: (fromIndex: number, toIndex: number) => void;
  updateInitiativeEntry: (id: string, updates: Partial<InitiativeEntry>) => void;
  addMonsterToInitiative: (monsterId: string, monsterName: string, initiative: number) => void;
  removeFromInitiative: (id: string) => void;
  getNextInstanceId: (baseName: string) => string;
  sortByInitiative: () => void;
}

export function useInitiativeOrder({
  initialOrder = []
}: UseInitiativeOrderProps = {}): UseInitiativeOrderReturn {
  const [initiativeOrder, setInitiativeOrder] = useState<InitiativeEntry[]>(initialOrder);

  const reorderInitiative = useCallback((fromIndex: number, toIndex: number) => {
    setInitiativeOrder(prev => {
      const newOrder = [...prev];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
      return newOrder;
    });
  }, []);

  const updateInitiativeEntry = useCallback((id: string, updates: Partial<InitiativeEntry>) => {
    setInitiativeOrder(prev =>
      prev.map(entry =>
        entry.id === id ? { ...entry, ...updates } : entry
      )
    );
  }, []);

  const getNextInstanceId = useCallback((baseName: string): string => {
    const existingInstances = initiativeOrder
      .filter(entry => entry.name === baseName)
      .map(entry => entry.instanceId)
      .filter(Boolean)
      .sort();

    if (existingInstances.length === 0) {
      return 'A';
    }

    // Find the next available letter
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      if (!existingInstances.includes(letter)) {
        return letter;
      }
    }

    // If all letters are used, return the next number
    return (existingInstances.length + 1).toString();
  }, [initiativeOrder]);

  const addMonsterToInitiative = useCallback((monsterId: string, monsterName: string, initiative: number) => {
    const instanceId = getNextInstanceId(monsterName);
    const displayName = instanceId ? `${monsterName} ${instanceId}` : monsterName;

    const newEntry: InitiativeEntry = {
      id: `${monsterId}_${instanceId || 'single'}`,
      name: displayName,
      type: 'monster',
      initiative,
      instanceId,
      conditions: [],
      currentHp: 0, // Will be set from monster data
      maxHp: 0,   // Will be set from monster data
      isActive: false,
    };

    setInitiativeOrder(prev => {
      const newOrder = [...prev, newEntry];
      // Sort by initiative (descending)
      return newOrder.sort((a, b) => b.initiative - a.initiative);
    });
  }, [getNextInstanceId]);

  const removeFromInitiative = useCallback((id: string) => {
    setInitiativeOrder(prev => prev.filter(entry => entry.id !== id));
  }, []);

  const sortByInitiative = useCallback(() => {
    setInitiativeOrder(prev =>
      [...prev].sort((a, b) => b.initiative - a.initiative)
    );
  }, []);

  return {
    initiativeOrder,
    setInitiativeOrder,
    reorderInitiative,
    updateInitiativeEntry,
    addMonsterToInitiative,
    removeFromInitiative,
    getNextInstanceId,
    sortByInitiative,
  };
}