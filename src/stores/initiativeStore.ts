import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  InitiativeState,
  InitiativeEntry,
  Condition,
  CombatEvent,
  CombatRound,
} from '@/types/initiative';
import { createInitiativeEntry } from '@/types/initiative';
import { characterSyncService } from '@/services/characterSyncService';

interface InitiativeStore extends InitiativeState {
  // Core Combat Actions
  startCombat: () => void;
  endCombat: () => void;
  pauseCombat: () => void;
  resumeCombat: () => void;
  nextTurn: () => void;
  previousTurn: () => void;

  // Entry Management
  addEntry: (entry: Omit<InitiativeEntry, 'id'>) => string;
  removeEntry: (entryId: string) => void;
  updateEntry: (entryId: string, updates: Partial<InitiativeEntry>) => void;
  reorderEntries: (fromIndex: number, toIndex: number) => void;
  setActiveEntry: (entryId: string | null) => void;

  // Initiative Management
  rollInitiativeForAll: () => void;
  rollInitiativeForEntry: (entryId: string) => void;
  setInitiative: (entryId: string, initiative: number) => void;
  sortEntriesByInitiative: () => void;
  setSortByInitiative: (sort: boolean) => void;

  // HP Management
  applyDamage: (entryId: string, damage: number, damageType?: string) => void;
  applyHealing: (entryId: string, healing: number) => void;
  setHP: (entryId: string, hp: number) => void;
  setMaxHP: (entryId: string, maxHP: number) => void;
  addTempHP: (entryId: string, tempHP: number) => void;

  // Condition Management
  addCondition: (entryId: string, condition: Condition) => void;
  removeCondition: (entryId: string, conditionId: string) => void;
  updateCondition: (
    entryId: string,
    conditionId: string,
    updates: Partial<Condition>,
  ) => void;

  // Death Saves (D&D 5e)
  rollDeathSave: (entryId: string, result: number) => void;
  resetDeathSaves: (entryId: string) => void;

  // Turn Management
  delayTurn: (entryId: string) => void;
  readyAction: (entryId: string) => void;

  // History and Events
  addEvent: (event: Omit<CombatEvent, 'id' | 'timestamp'>) => void;
  getCombatLog: () => CombatEvent[];

  // Settings
  updateSettings: (
    settings: Partial<
      Pick<
        InitiativeState,
        | 'autoAdvanceTurns'
        | 'showPlayerHP'
        | 'allowPlayerInitiative'
        | 'sortByInitiative'
      >
    >,
  ) => void;

  // Utility
  reset: () => void;
  getEntry: (entryId: string) => InitiativeEntry | undefined;
  getActiveEntry: () => InitiativeEntry | undefined;
  getCurrentRound: () => CombatRound | undefined;
}

const initialState: InitiativeState = {
  isActive: false,
  isPaused: false,
  round: 0,
  entries: [],
  activeEntryId: null,
  history: [],
  autoAdvanceTurns: false,
  showPlayerHP: true,
  allowPlayerInitiative: true,
  sortByInitiative: true,
};

export const useInitiativeStore = create<InitiativeStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

    // Core Combat Actions
    startCombat: () =>
      set((state) => {
        if (state.entries.length === 0) return;

        state.isActive = true;
        state.isPaused = false;
        state.round = 1;

        // Sort by initiative if enabled
        if (state.sortByInitiative) {
          state.entries.sort((a, b) => b.initiative - a.initiative);
        }

        // Set first entry as active
        if (state.entries.length > 0) {
          state.activeEntryId = state.entries[0].id;
          state.entries.forEach((entry) => {
            entry.isActive = entry.id === state.activeEntryId;
          });
        }

        // Create first round
        state.history = [
          {
            number: 1,
            startTime: Date.now(),
            activeEntryId: state.activeEntryId,
            events: [],
          },
        ];

        // Add combat start event
        get().addEvent({
          type: 'turn_start',
          entryId: state.activeEntryId || '',
          description: 'Combat started',
        });
      }),

    endCombat: () =>
      set((state) => {
        state.isActive = false;
        state.isPaused = false;
        state.activeEntryId = null;
        state.entries.forEach((entry) => {
          entry.isActive = false;
          entry.isReady = false;
          entry.isDelayed = false;
        });
      }),

    pauseCombat: () =>
      set((state) => {
        state.isPaused = true;
      }),

    resumeCombat: () =>
      set((state) => {
        state.isPaused = false;
      }),

    nextTurn: () =>
      set((state) => {
        if (!state.isActive || state.entries.length === 0) return;

        const currentIndex = state.activeEntryId
          ? state.entries.findIndex((e) => e.id === state.activeEntryId)
          : -1;

        const nextIndex = (currentIndex + 1) % state.entries.length;

        // If we've wrapped around, increment round
        if (nextIndex === 0) {
          state.round += 1;
          state.history.push({
            number: state.round,
            startTime: Date.now(),
            activeEntryId: state.entries[0].id,
            events: [],
          });
        }

        // Set new active entry
        const nextEntry = state.entries[nextIndex];
        state.activeEntryId = nextEntry.id;
        state.entries.forEach((entry) => {
          entry.isActive = entry.id === state.activeEntryId;
        });

        // Add turn start event
        get().addEvent({
          type: 'turn_start',
          entryId: nextEntry.id,
          description: `${nextEntry.name}'s turn`,
        });

        // Decrement condition durations
        state.entries.forEach((entry) => {
          entry.conditions = entry.conditions.filter((condition) => {
            if (condition.duration !== undefined) {
              condition.duration -= 1;
              return condition.duration > 0;
            }
            return true;
          });
        });
      }),

    previousTurn: () =>
      set((state) => {
        if (!state.isActive || state.entries.length === 0) return;

        const currentIndex = state.activeEntryId
          ? state.entries.findIndex((e) => e.id === state.activeEntryId)
          : 0;

        let prevIndex = currentIndex - 1;

        if (prevIndex < 0) {
          prevIndex = state.entries.length - 1;
          if (state.round > 1) {
            state.round -= 1;
          }
        }

        const prevEntry = state.entries[prevIndex];
        state.activeEntryId = prevEntry.id;
        state.entries.forEach((entry) => {
          entry.isActive = entry.id === state.activeEntryId;
        });
      }),

    // Entry Management
    addEntry: (entryData) => {
      const entry = createInitiativeEntry(
        entryData.name,
        entryData.type,
        entryData.initiative,
        entryData,
      );

      set((state) => {
        state.entries.push(entry);
        if (state.sortByInitiative) {
          state.entries.sort((a, b) => b.initiative - a.initiative);
        }
      });

      return entry.id;
    },

    removeEntry: (entryId) =>
      set((state) => {
        const index = state.entries.findIndex((e) => e.id === entryId);
        if (index !== -1) {
          state.entries.splice(index, 1);

          if (state.activeEntryId === entryId) {
            if (state.entries.length > 0) {
              const newIndex = Math.min(index, state.entries.length - 1);
              state.activeEntryId = state.entries[newIndex]?.id || null;
            } else {
              state.activeEntryId = null;
            }
          }
        }
      }),

    updateEntry: (entryId, updates) =>
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry) {
          Object.assign(entry, updates);
        }
      }),

    reorderEntries: (fromIndex, toIndex) =>
      set((state) => {
        const [movedEntry] = state.entries.splice(fromIndex, 1);
        state.entries.splice(toIndex, 0, movedEntry);
      }),

    setActiveEntry: (entryId) =>
      set((state) => {
        state.activeEntryId = entryId;
        state.entries.forEach((entry) => {
          entry.isActive = entry.id === entryId;
        });
      }),

    // Initiative Management
    rollInitiativeForAll: () =>
      set((state) => {
        state.entries.forEach((entry) => {
          const roll = Math.ceil(Math.random() * 20);
          entry.initiative = roll + entry.initiativeModifier;

          get().addEvent({
            type: 'initiative_rolled',
            entryId: entry.id,
            description: `${entry.name} rolled initiative: ${roll} + ${entry.initiativeModifier} = ${entry.initiative}`,
            rollResult: roll,
          });
        });

        if (state.sortByInitiative) {
          state.entries.sort((a, b) => b.initiative - a.initiative);
        }
      }),

    rollInitiativeForEntry: (entryId) =>
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry) {
          const roll = Math.ceil(Math.random() * 20);
          entry.initiative = roll + entry.initiativeModifier;

          get().addEvent({
            type: 'initiative_rolled',
            entryId: entry.id,
            description: `${entry.name} rolled initiative: ${roll} + ${entry.initiativeModifier} = ${entry.initiative}`,
            rollResult: roll,
          });

          if (state.sortByInitiative) {
            state.entries.sort((a, b) => b.initiative - a.initiative);
          }
        }
      }),

    setInitiative: (entryId, initiative) =>
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry) {
          entry.initiative = initiative;
          if (state.sortByInitiative) {
            state.entries.sort((a, b) => b.initiative - a.initiative);
          }
        }
      }),

    sortEntriesByInitiative: () =>
      set((state) => {
        state.entries.sort((a, b) => b.initiative - a.initiative);
      }),

    setSortByInitiative: (sort: boolean) =>
      set((state) => {
        state.sortByInitiative = sort;
      }),

    // HP Management
    applyDamage: (entryId, damage, damageType = 'untyped') => {
      // Update state synchronously
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry) {
          let actualDamage = damage;

          // Apply temp HP first
          if (entry.tempHP > 0) {
            const tempDamage = Math.min(entry.tempHP, actualDamage);
            entry.tempHP -= tempDamage;
            actualDamage -= tempDamage;
          }

          // Apply remaining damage to current HP
          entry.currentHP = Math.max(0, entry.currentHP - actualDamage);

          get().addEvent({
            type: 'damage',
            entryId: entry.id,
            description: `${entry.name} takes ${damage} ${damageType} damage`,
            amount: damage,
          });
        }
      });

      // AFTER state update: trigger sync
      const entry = get().entries.find((e) => e.id === entryId);
      if (entry) {
        characterSyncService.syncStats('initiative', {
          initiativeEntryId: entryId,
          characterId: entry.characterId,
          tokenId: entry.tokenId,
          stats: {
            currentHP: entry.currentHP,
            tempHP: entry.tempHP,
          },
        });
      }
    },

    applyHealing: (entryId, healing) => {
      // Update state synchronously
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry) {
          const oldHP = entry.currentHP;
          entry.currentHP = Math.min(entry.maxHP, entry.currentHP + healing);
          const actualHealing = entry.currentHP - oldHP;

          get().addEvent({
            type: 'healing',
            entryId: entry.id,
            description: `${entry.name} heals ${actualHealing} HP`,
            amount: actualHealing,
          });
        }
      });

      // AFTER state update: trigger sync
      const entry = get().entries.find((e) => e.id === entryId);
      if (entry) {
        characterSyncService.syncStats('initiative', {
          initiativeEntryId: entryId,
          characterId: entry.characterId,
          tokenId: entry.tokenId,
          stats: {
            currentHP: entry.currentHP,
          },
        });
      }
    },

    setHP: (entryId, hp) => {
      // Update state synchronously
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry) {
          entry.currentHP = Math.max(0, Math.min(entry.maxHP, hp));
        }
      });

      // AFTER state update: trigger sync
      const entry = get().entries.find((e) => e.id === entryId);
      if (entry) {
        characterSyncService.syncStats('initiative', {
          initiativeEntryId: entryId,
          characterId: entry.characterId,
          tokenId: entry.tokenId,
          stats: {
            currentHP: entry.currentHP,
          },
        });
      }
    },

    setMaxHP: (entryId, maxHP) =>
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry) {
          entry.maxHP = Math.max(1, maxHP);
          entry.currentHP = Math.min(entry.currentHP, entry.maxHP);
        }
      }),

    addTempHP: (entryId, tempHP) => {
      // Update state synchronously
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry) {
          entry.tempHP = Math.max(entry.tempHP, tempHP); // Temp HP doesn't stack
        }
      });

      // AFTER state update: trigger sync
      const entry = get().entries.find((e) => e.id === entryId);
      if (entry) {
        characterSyncService.syncStats('initiative', {
          initiativeEntryId: entryId,
          characterId: entry.characterId,
          tokenId: entry.tokenId,
          stats: {
            tempHP: entry.tempHP,
          },
        });
      }
    },

    // Condition Management
    addCondition: (entryId, condition) =>
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry) {
          // Remove existing condition of same type
          entry.conditions = entry.conditions.filter(
            (c) => c.id !== condition.id,
          );
          entry.conditions.push({ ...condition, id: crypto.randomUUID() });

          get().addEvent({
            type: 'condition_applied',
            entryId: entry.id,
            description: `${entry.name} gains ${condition.name}`,
            conditionId: condition.id,
          });
        }
      }),

    removeCondition: (entryId, conditionId) =>
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry) {
          const condition = entry.conditions.find((c) => c.id === conditionId);
          entry.conditions = entry.conditions.filter(
            (c) => c.id !== conditionId,
          );

          if (condition) {
            get().addEvent({
              type: 'condition_removed',
              entryId: entry.id,
              description: `${entry.name} loses ${condition.name}`,
              conditionId: condition.id,
            });
          }
        }
      }),

    updateCondition: (entryId, conditionId, updates) =>
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry) {
          const condition = entry.conditions.find((c) => c.id === conditionId);
          if (condition) {
            Object.assign(condition, updates);
          }
        }
      }),

    // Death Saves
    rollDeathSave: (entryId, result) =>
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry && entry.currentHP === 0) {
          if (result === 20) {
            // Natural 20 - regain 1 HP
            entry.currentHP = 1;
            entry.deathSaves.successes = 0;
            entry.deathSaves.failures = 0;
          } else if (result === 1) {
            // Natural 1 - count as 2 failures
            entry.deathSaves.failures = Math.min(
              3,
              entry.deathSaves.failures + 2,
            );
          } else if (result >= 10) {
            // Success
            entry.deathSaves.successes = Math.min(
              3,
              entry.deathSaves.successes + 1,
            );
          } else {
            // Failure
            entry.deathSaves.failures = Math.min(
              3,
              entry.deathSaves.failures + 1,
            );
          }

          get().addEvent({
            type: 'death_save',
            entryId: entry.id,
            description: `${entry.name} death save: ${result}`,
            rollResult: result,
          });
        }
      }),

    resetDeathSaves: (entryId) =>
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry) {
          entry.deathSaves.successes = 0;
          entry.deathSaves.failures = 0;
        }
      }),

    // Turn Management
    delayTurn: (entryId) =>
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry) {
          entry.isDelayed = !entry.isDelayed;
          entry.isReady = false;
        }
      }),

    readyAction: (entryId) =>
      set((state) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (entry) {
          entry.isReady = !entry.isReady;
          entry.isDelayed = false;
        }
      }),

    // History and Events
    addEvent: (eventData) =>
      set((state) => {
        const event = {
          ...eventData,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        };

        const currentRound = state.history[state.history.length - 1];
        if (currentRound) {
          currentRound.events.push(event);
        }
      }),

    getCombatLog: () => {
      const state = get();
      return state.history
        .flatMap((round) => round.events)
        .sort((a, b) => a.timestamp - b.timestamp);
    },

    // Settings
    updateSettings: (settings) =>
      set((state) => {
        Object.assign(state, settings);

        if (settings.sortByInitiative) {
          state.entries.sort((a, b) => b.initiative - a.initiative);
        }
      }),

    // Utility
    reset: () => set(() => ({ ...initialState })),

    getEntry: (entryId) => {
      return get().entries.find((e) => e.id === entryId);
    },

    getActiveEntry: () => {
      const state = get();
      return state.activeEntryId
        ? state.entries.find((e) => e.id === state.activeEntryId)
        : undefined;
    },

    getCurrentRound: () => {
      const state = get();
      return state.history[state.history.length - 1];
    },
  })),
    {
      name: 'nexus-initiative-tracker',
    },
  ),
);

// Helper hooks for common operations
export const useInitiative = () => {
  const store = useInitiativeStore();
  return {
    isActive: store.isActive,
    isPaused: store.isPaused,
    round: store.round,
    entries: store.entries,
    activeEntry: store.getActiveEntry(),
    combatLog: store.getCombatLog(),
  };
};

export const useInitiativeActions = () => {
  const store = useInitiativeStore();
  return {
    startCombat: store.startCombat,
    endCombat: store.endCombat,
    nextTurn: store.nextTurn,
    previousTurn: store.previousTurn,
    addEntry: store.addEntry,
    removeEntry: store.removeEntry,
    updateEntry: store.updateEntry,
    reorderEntries: store.reorderEntries,
    applyDamage: store.applyDamage,
    applyHealing: store.applyHealing,
    addCondition: store.addCondition,
    removeCondition: store.removeCondition,
    rollInitiativeForAll: store.rollInitiativeForAll,
  };
};
