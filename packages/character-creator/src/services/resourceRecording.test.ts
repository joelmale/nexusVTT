import { describe, expect, it } from 'vitest';
import {
  recordCharacterResource,
  recoverCharacterResource,
  type CharacterResource,
} from '@nexus/character-contracts';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import {
  canUseResource,
  consumeResource,
  reconcileCharacterResources,
} from './resourceLifecycle';

const resource: CharacterResource = {
  id: 'divine-intervention',
  name: 'Divine Intervention',
  description: '',
  maxUses: 1,
  rechargeType: 'long-rest',
  recovery: { longRest: 'full' },
};
describe('explicit resource records and game-time cooldowns', () => {
  it('establishes unknown balances without mutating the prior record', () => {
    expect(recordCharacterResource(resource, 1)).toMatchObject({
      currentUses: 1,
    });
    expect(resource.currentUses).toBeUndefined();
  });
  it.each([-1, 2, 0.5, NaN, Infinity])(
    'rejects invalid balances %s',
    (count) => {
      expect(() => recordCharacterResource(resource, count)).toThrow();
    },
  );
  it('rejects inactive, unlimited and contradictory cooldown records', () => {
    for (const input of [
      { ...resource, active: false },
      { ...resource, unlimited: true },
    ])
      expect(() => recordCharacterResource(input, 1)).toThrow();
    expect(() =>
      recordCharacterResource(resource, 1, { remaining: 2, unit: 'long-rest' }),
    ).toThrow('zero');
    expect(() =>
      recordCharacterResource(resource, 0, { remaining: -1, unit: 'day' }),
    ).toThrow('cooldown');
  });
  it('requires the recorded number of long rests before recovery and ignores short rests', () => {
    const recorded = recordCharacterResource(resource, 0, {
      remaining: 2,
      unit: 'long-rest',
    });
    expect(recoverCharacterResource(recorded, 'short-rest')).toEqual(recorded);
    const first = recoverCharacterResource(recorded, 'long-rest');
    expect(first).toMatchObject({ currentUses: 0, cooldown: { remaining: 1 } });
    expect(recoverCharacterResource(first, 'long-rest')).toMatchObject({
      currentUses: 1,
      cooldown: { remaining: 0 },
    });
    expect(recorded.cooldown?.remaining).toBe(2);
  });
  it('does not treat long rests as days; only an explicit day record clears the cooldown', () => {
    const recorded = recordCharacterResource(resource, 0, {
      remaining: 7,
      unit: 'day',
    });
    expect(recoverCharacterResource(recorded, 'long-rest')).toEqual(recorded);
    expect(
      recordCharacterResource(recorded, 1, { remaining: 0, unit: 'day' })
        .currentUses,
    ).toBe(1);
  });
  it('preserves cooldowns during reconciliation and rejects consumption even for an inconsistent imported balance', () => {
    const character = calculateCharacterStats(
      REFERENCE_BUILDS.F24.creationData,
    );
    const wind = character.resources!.find(
      (entry) => entry.id === 'second-wind',
    )!;
    wind.cooldown = { remaining: 3, unit: 'day' };
    const loaded = reconcileCharacterResources(character);
    expect(
      loaded.resources!.find((entry) => entry.id === 'second-wind')!.cooldown,
    ).toEqual(wind.cooldown);
    expect(canUseResource(loaded, 'second-wind')).toBe(false);
    expect(consumeResource(loaded, 'second-wind')).toBe(loaded);
  });
});
