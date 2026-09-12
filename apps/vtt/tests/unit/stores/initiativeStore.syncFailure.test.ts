import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/characterSyncService', () => {
  throw new Error('character sync service is unavailable');
});

import { useInitiativeStore } from '../../../src/stores/initiativeStore';

describe('initiativeStore character sync loading', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useInitiativeStore.getState().reset();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('logs one lazy-load failure without delaying state updates or retrying', async () => {
    const entryId = useInitiativeStore.getState().addEntry({
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

    const store = useInitiativeStore.getState();
    store.applyDamage(entryId, 5);

    expect(store.getEntry(entryId)?.currentHP).toBe(20);
    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load character sync service for initiative stat sync.',
        expect.any(Error),
      );
    });

    store.applyDamage(entryId, 5);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
