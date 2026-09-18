import { describe, it, expect, beforeEach, vi } from 'vitest';

const { syncStats } = vi.hoisted(() => ({ syncStats: vi.fn() }));

vi.mock('@/services/characterSyncService', () => ({
  characterSyncService: { syncStats },
}));

import { useInitiativeStore } from '../../../src/stores/initiativeStore';
import { STANDARD_CONDITIONS } from '../../../src/types/initiative';

describe('initiativeStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useInitiativeStore.getState().reset();
    syncStats.mockClear();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useInitiativeStore.getState();

      expect(state.isActive).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.round).toBe(0);
      expect(state.entries).toEqual([]);
      expect(state.activeEntryId).toBe(null);
      expect(state.history).toEqual([]);
      expect(state.showPlayerHP).toBe(true);
      expect(state.sortByInitiative).toBe(true);
    });
  });

  describe('Entry Management', () => {
    it('should add entries correctly', () => {
      const store = useInitiativeStore.getState();

      const entryId = store.addEntry({
        name: 'Fighter',
        type: 'player',
        initiative: 15,
        maxHP: 25,
        currentHP: 25,
        tempHP: 0,
        armorClass: 16,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 2,
        dexterityModifier: 2,
      });

      const state = useInitiativeStore.getState();
      expect(state.entries).toHaveLength(1);
      expect(state.entries[0].name).toBe('Fighter');
      expect(state.entries[0].id).toBe(entryId);
    });

    it('should remove entries correctly', () => {
      const store = useInitiativeStore.getState();

      const entryId = store.addEntry({
        name: 'Fighter',
        type: 'player',
        initiative: 15,
        maxHP: 25,
        currentHP: 25,
        tempHP: 0,
        armorClass: 16,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 2,
        dexterityModifier: 2,
      });

      store.removeEntry(entryId);

      const state = useInitiativeStore.getState();
      expect(state.entries).toHaveLength(0);
    });

    it('should update entries correctly', () => {
      const store = useInitiativeStore.getState();

      const entryId = store.addEntry({
        name: 'Fighter',
        type: 'player',
        initiative: 15,
        maxHP: 25,
        currentHP: 25,
        tempHP: 0,
        armorClass: 16,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 2,
        dexterityModifier: 2,
      });

      store.updateEntry(entryId, { name: 'Updated Fighter', initiative: 20 });

      const state = useInitiativeStore.getState();
      expect(state.entries[0].name).toBe('Updated Fighter');
      expect(state.entries[0].initiative).toBe(20);
    });
  });

  describe('Combat Management', () => {
    beforeEach(() => {
      const store = useInitiativeStore.getState();

      // Add test entries
      store.addEntry({
        name: 'Fighter',
        type: 'player',
        initiative: 20,
        maxHP: 25,
        currentHP: 25,
        tempHP: 0,
        armorClass: 16,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 2,
        dexterityModifier: 2,
      });

      store.addEntry({
        name: 'Goblin',
        type: 'monster',
        initiative: 15,
        maxHP: 7,
        currentHP: 7,
        tempHP: 0,
        armorClass: 15,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 2,
        dexterityModifier: 2,
      });
    });

    it('should start combat correctly', () => {
      const store = useInitiativeStore.getState();
      store.startCombat();

      const state = useInitiativeStore.getState();
      expect(state.isActive).toBe(true);
      expect(state.round).toBe(1);
      expect(state.activeEntryId).toBe(state.entries[0].id); // First in initiative order
      expect(state.history).toHaveLength(1);
    });

    it('should advance turns correctly', () => {
      const store = useInitiativeStore.getState();
      store.startCombat();

      const initialActiveId = useInitiativeStore.getState().activeEntryId;

      store.nextTurn();

      const state = useInitiativeStore.getState();
      expect(state.activeEntryId).not.toBe(initialActiveId);
      expect(state.entries.find(e => e.id === state.activeEntryId)?.isActive).toBe(true);
    });

    it('should increment round when cycling through all entries', () => {
      const store = useInitiativeStore.getState();
      store.startCombat();

      // Go through all entries
      store.nextTurn(); // Second entry
      store.nextTurn(); // Should wrap to first entry and increment round

      const state = useInitiativeStore.getState();
      expect(state.round).toBe(2);
    });

    it('should end combat correctly', () => {
      const store = useInitiativeStore.getState();
      store.startCombat();
      store.endCombat();

      const state = useInitiativeStore.getState();
      expect(state.isActive).toBe(false);
      expect(state.activeEntryId).toBe(null);
      expect(state.entries.every(e => !e.isActive)).toBe(true);
    });
  });

  describe('HP Management', () => {
    let entryId: string;

    beforeEach(() => {
      const store = useInitiativeStore.getState();
      entryId = store.addEntry({
        name: 'Fighter',
        type: 'player',
        initiative: 15,
        maxHP: 25,
        currentHP: 25,
        tempHP: 5,
        armorClass: 16,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 2,
        dexterityModifier: 2,
      });
    });

    it('syncs damage after updating HP and temporary HP', async () => {
      const store = useInitiativeStore.getState();
      store.applyDamage(entryId, 8);

      const entry = store.getEntry(entryId);
      expect(entry?.tempHP).toBe(0); // 5 temp HP absorbed 5 damage
      expect(entry?.currentHP).toBe(22); // Remaining 3 damage applied to current HP

      await vi.waitFor(() => {
        expect(syncStats).toHaveBeenCalledWith('initiative', {
          initiativeEntryId: entryId,
          characterId: undefined,
          tokenId: undefined,
          stats: { currentHP: 22, tempHP: 0 },
        });
      });
    });

    it('syncs healing after updating HP', async () => {
      const store = useInitiativeStore.getState();
      store.setHP(entryId, 20);
      await vi.waitFor(() => expect(syncStats).toHaveBeenCalledTimes(1));
      syncStats.mockClear();

      store.applyHealing(entryId, 5); // Heal 5 up to max => currentHP 25

      const entry = store.getEntry(entryId);
      expect(entry?.currentHP).toBe(25);

      await vi.waitFor(() => {
        expect(syncStats).toHaveBeenCalledWith('initiative', {
          initiativeEntryId: entryId,
          characterId: undefined,
          tokenId: undefined,
          stats: { currentHP: 25 },
        });
      });
    });

    it('should not heal above max HP', () => {
      const store = useInitiativeStore.getState();
      store.applyHealing(entryId, 10);

      const entry = store.getEntry(entryId);
      expect(entry?.currentHP).toBe(25); // Capped at max HP
    });

    it('should not reduce HP below 0', () => {
      const store = useInitiativeStore.getState();
      store.applyDamage(entryId, 50);

      const entry = store.getEntry(entryId);
      expect(entry?.currentHP).toBe(0);
    });

    it('syncs a direct HP update after updating state', async () => {
      const store = useInitiativeStore.getState();
      store.setHP(entryId, 12);

      expect(store.getEntry(entryId)?.currentHP).toBe(12);
      await vi.waitFor(() => {
        expect(syncStats).toHaveBeenCalledWith('initiative', {
          initiativeEntryId: entryId,
          characterId: undefined,
          tokenId: undefined,
          stats: { currentHP: 12 },
        });
      });
    });

    it('syncs temporary HP after updating state', async () => {
      const store = useInitiativeStore.getState();
      store.addTempHP(entryId, 8);

      expect(store.getEntry(entryId)?.tempHP).toBe(8);
      await vi.waitFor(() => {
        expect(syncStats).toHaveBeenCalledWith('initiative', {
          initiativeEntryId: entryId,
          characterId: undefined,
          tokenId: undefined,
          stats: { tempHP: 8 },
        });
      });
    });
  });

  describe('Condition Management', () => {
    let entryId: string;

    beforeEach(() => {
      const store = useInitiativeStore.getState();
      entryId = store.addEntry({
        name: 'Fighter',
        type: 'player',
        initiative: 15,
        maxHP: 25,
        currentHP: 25,
        tempHP: 0,
        armorClass: 16,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 2,
        dexterityModifier: 2,
      });
    });

    it('should add conditions correctly', () => {
      const store = useInitiativeStore.getState();
      const poisonedCondition = STANDARD_CONDITIONS.find(c => c.id === 'poisoned')!;

      store.addCondition(entryId, poisonedCondition);

      const entry = store.getEntry(entryId);
      expect(entry?.conditions).toHaveLength(1);
      expect(entry?.conditions[0].name).toBe('Poisoned');
    });

    it('should remove conditions correctly', () => {
      const store = useInitiativeStore.getState();
      const poisonedCondition = STANDARD_CONDITIONS.find(c => c.id === 'poisoned')!;

      store.addCondition(entryId, poisonedCondition);
      const entry = store.getEntry(entryId);
      const conditionId = entry?.conditions[0].id;

      if (conditionId) {
        store.removeCondition(entryId, conditionId);
      }

      const updatedEntry = store.getEntry(entryId);
      expect(updatedEntry?.conditions).toHaveLength(0);
    });
  });

  describe('Death Saves', () => {
    let entryId: string;

    beforeEach(() => {
      const store = useInitiativeStore.getState();
      entryId = store.addEntry({
        name: 'Fighter',
        type: 'player',
        initiative: 15,
        maxHP: 25,
        currentHP: 0, // Start at 0 HP for death save tests
        tempHP: 0,
        armorClass: 16,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 2,
        dexterityModifier: 2,
      });
    });

    it('should handle death save success', () => {
      const store = useInitiativeStore.getState();
      store.rollDeathSave(entryId, 15); // Success

      const entry = store.getEntry(entryId);
      expect(entry?.deathSaves.successes).toBe(1);
      expect(entry?.deathSaves.failures).toBe(0);
    });

    it('should handle death save failure', () => {
      const store = useInitiativeStore.getState();
      store.rollDeathSave(entryId, 8); // Failure

      const entry = store.getEntry(entryId);
      expect(entry?.deathSaves.successes).toBe(0);
      expect(entry?.deathSaves.failures).toBe(1);
    });

    it('should handle natural 20 death save', () => {
      const store = useInitiativeStore.getState();
      store.rollDeathSave(entryId, 20); // Natural 20

      const entry = store.getEntry(entryId);
      expect(entry?.currentHP).toBe(1); // Regain 1 HP
      expect(entry?.deathSaves.successes).toBe(0); // Reset
      expect(entry?.deathSaves.failures).toBe(0); // Reset
    });

    it('should handle natural 1 death save', () => {
      const store = useInitiativeStore.getState();
      store.rollDeathSave(entryId, 1); // Natural 1

      const entry = store.getEntry(entryId);
      expect(entry?.deathSaves.failures).toBe(2); // Count as 2 failures
    });
  });

  describe('Initiative Rolling', () => {
    it('should roll initiative for all entries', () => {
      const store = useInitiativeStore.getState();

      // Mock Math.random to return predictable values
      const mockRandom = vi.spyOn(Math, 'random');
      mockRandom.mockReturnValueOnce(0.5); // Roll of 10
      mockRandom.mockReturnValueOnce(0.8); // Roll of 16

      store.addEntry({
        name: 'Fighter',
        type: 'player',
        initiative: 0,
        maxHP: 25,
        currentHP: 25,
        tempHP: 0,
        armorClass: 16,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 3,
        dexterityModifier: 3,
      });

      store.addEntry({
        name: 'Wizard',
        type: 'player',
        initiative: 0,
        maxHP: 15,
        currentHP: 15,
        tempHP: 0,
        armorClass: 12,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 1,
        dexterityModifier: 1,
      });

      store.rollInitiativeForAll();

      const state = useInitiativeStore.getState();
      // Note: The order may have changed due to sorting by initiative
      const fighter = state.entries.find(e => e.name === 'Fighter');
      const wizard = state.entries.find(e => e.name === 'Wizard');

      expect(fighter?.initiative).toBe(13); // 10 + 3
      expect(wizard?.initiative).toBe(17); // 16 + 1

      mockRandom.mockRestore();
    });
  });

  describe('Utility Functions', () => {
    it('should get entry by ID', () => {
      const store = useInitiativeStore.getState();
      const entryId = store.addEntry({
        name: 'Fighter',
        type: 'player',
        initiative: 15,
        maxHP: 25,
        currentHP: 25,
        tempHP: 0,
        armorClass: 16,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 2,
        dexterityModifier: 2,
      });

      const entry = store.getEntry(entryId);
      expect(entry?.name).toBe('Fighter');
    });

    it('should get active entry', () => {
      const store = useInitiativeStore.getState();
      store.addEntry({
        name: 'Fighter',
        type: 'player',
        initiative: 15,
        maxHP: 25,
        currentHP: 25,
        tempHP: 0,
        armorClass: 16,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 2,
        dexterityModifier: 2,
      });

      store.startCombat();

      const activeEntry = store.getActiveEntry();
      expect(activeEntry?.name).toBe('Fighter');
    });

    it('should reset store correctly', () => {
      const store = useInitiativeStore.getState();

      // Add some data
      store.addEntry({
        name: 'Fighter',
        type: 'player',
        initiative: 15,
        maxHP: 25,
        currentHP: 25,
        tempHP: 0,
        armorClass: 16,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 2,
        dexterityModifier: 2,
      });
      store.startCombat();

      // Reset
      store.reset();

      const state = useInitiativeStore.getState();
      expect(state.isActive).toBe(false);
      expect(state.entries).toEqual([]);
      expect(state.round).toBe(0);
    });
  });

  describe('Advanced Turn and Death Save Management', () => {
    it('handles previousTurn wrapping around to previous round', () => {
      const store = useInitiativeStore.getState();
      const id1 = store.addEntry({
        name: 'A',
        type: 'player',
        initiative: 20,
        maxHP: 10,
        currentHP: 10,
        tempHP: 0,
        armorClass: 10,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 0,
        dexterityModifier: 0,
      });
      const id2 = store.addEntry({
        name: 'B',
        type: 'player',
        initiative: 10,
        maxHP: 10,
        currentHP: 10,
        tempHP: 0,
        armorClass: 10,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 0,
        dexterityModifier: 0,
      });

      store.startCombat();
      expect(useInitiativeStore.getState().round).toBe(1);
      expect(useInitiativeStore.getState().activeEntryId).toBe(id1);

      // Advance to B, then advance to A (round 2)
      store.nextTurn();
      expect(useInitiativeStore.getState().activeEntryId).toBe(id2);
      store.nextTurn();
      expect(useInitiativeStore.getState().round).toBe(2);
      expect(useInitiativeStore.getState().activeEntryId).toBe(id1);

      // Previous turn wraps back to B and decrements round
      store.previousTurn();
      expect(useInitiativeStore.getState().round).toBe(1);
      expect(useInitiativeStore.getState().activeEntryId).toBe(id2);
    });

    it('handles removing the active entry and selects the adjacent entry', () => {
      const store = useInitiativeStore.getState();
      const id1 = store.addEntry({
        name: 'First',
        type: 'player',
        initiative: 20,
        maxHP: 10,
        currentHP: 10,
        tempHP: 0,
        armorClass: 10,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 0,
        dexterityModifier: 0,
      });
      const id2 = store.addEntry({
        name: 'Second',
        type: 'player',
        initiative: 10,
        maxHP: 10,
        currentHP: 10,
        tempHP: 0,
        armorClass: 10,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 0,
        dexterityModifier: 0,
      });

      store.startCombat();
      expect(useInitiativeStore.getState().activeEntryId).toBe(id1);

      store.removeEntry(id1);
      expect(useInitiativeStore.getState().activeEntryId).toBe(id2);

      store.removeEntry(id2);
      expect(useInitiativeStore.getState().activeEntryId).toBeNull();
    });

    it('reorders entries manually', () => {
      const store = useInitiativeStore.getState();
      store.setSortByInitiative(false);
      store.addEntry({
        name: 'First',
        type: 'player',
        initiative: 10,
        maxHP: 10,
        currentHP: 10,
        tempHP: 0,
        armorClass: 10,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 0,
        dexterityModifier: 0,
      });
      store.addEntry({
        name: 'Second',
        type: 'player',
        initiative: 10,
        maxHP: 10,
        currentHP: 10,
        tempHP: 0,
        armorClass: 10,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 0,
        dexterityModifier: 0,
      });

      store.reorderEntries(0, 1);
      expect(useInitiativeStore.getState().entries[0].name).toBe('Second');
      expect(useInitiativeStore.getState().entries[1].name).toBe('First');
    });

    it('manages death saves correctly: nat 20, nat 1, successes, failures, and reset', () => {
      const store = useInitiativeStore.getState();
      const id = store.addEntry({
        name: 'Dying Fighter',
        type: 'player',
        initiative: 10,
        maxHP: 20,
        currentHP: 0,
        tempHP: 0,
        armorClass: 10,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 0,
        dexterityModifier: 0,
      });

      // Regular success (>= 10)
      store.rollDeathSave(id, 12);
      expect(store.getEntry(id)?.deathSaves.successes).toBe(1);

      // Regular failure (< 10)
      store.rollDeathSave(id, 8);
      expect(store.getEntry(id)?.deathSaves.failures).toBe(1);

      // Nat 1 (2 failures)
      store.rollDeathSave(id, 1);
      expect(store.getEntry(id)?.deathSaves.failures).toBe(3);

      // Reset death saves
      store.resetDeathSaves(id);
      expect(store.getEntry(id)?.deathSaves).toEqual({ successes: 0, failures: 0 });

      // Nat 20: regains 1 HP and clears saves
      store.rollDeathSave(id, 20);
      expect(store.getEntry(id)?.currentHP).toBe(1);
      expect(store.getEntry(id)?.deathSaves).toEqual({ successes: 0, failures: 0 });
    });

    it('toggles delayed turn and ready action mutually exclusively', () => {
      const store = useInitiativeStore.getState();
      const id = store.addEntry({
        name: 'Tactician',
        type: 'player',
        initiative: 15,
        maxHP: 20,
        currentHP: 20,
        tempHP: 0,
        armorClass: 10,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 0,
        dexterityModifier: 0,
      });

      store.delayTurn(id);
      expect(store.getEntry(id)?.isDelayed).toBe(true);
      expect(store.getEntry(id)?.isReady).toBe(false);

      store.readyAction(id);
      expect(store.getEntry(id)?.isReady).toBe(true);
      expect(store.getEntry(id)?.isDelayed).toBe(false);
    });

    it('updates conditions on entries', () => {
      const store = useInitiativeStore.getState();
      const id = store.addEntry({
        name: 'Target',
        type: 'monster',
        initiative: 10,
        maxHP: 20,
        currentHP: 20,
        tempHP: 0,
        armorClass: 10,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 0,
        dexterityModifier: 0,
      });

      store.addCondition(id, {
        id: 'poisoned',
        name: 'Poisoned',
        description: 'Disadvantage on attacks',
        duration: 3,
        source: 'Poison dart',
      });

      const entry = store.getEntry(id);
      expect(entry?.conditions).toHaveLength(1);
      const condId = entry!.conditions[0].id;

      store.updateCondition(id, condId, { duration: 5, description: 'Severe poison' });
      const updated = store.getEntry(id);
      expect(updated?.conditions[0].duration).toBe(5);
      expect(updated?.conditions[0].description).toBe('Severe poison');
    });

    it('records and returns combat log and current round', () => {
      const store = useInitiativeStore.getState();
      store.addEntry({
        name: 'Hero',
        type: 'player',
        initiative: 10,
        maxHP: 10,
        currentHP: 10,
        tempHP: 0,
        armorClass: 10,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 0,
        dexterityModifier: 0,
      });

      store.startCombat();
      expect(store.getCurrentRound()?.number).toBe(1);

      store.addEvent({
        type: 'damage',
        entryId: 'e1',
        description: 'Hero took 5 damage',
      });
      expect(store.getCombatLog().length).toBeGreaterThan(0);
      expect(store.getCombatLog()[0].description).toBe('Hero took 5 damage');
    });
  });
});
