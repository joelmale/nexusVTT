import { describe, expect, it } from 'vitest';
import {
  buildSimpleCombatView,
  HIDDEN_TURN_LABEL,
  type BuildSimpleCombatViewInput,
} from '@/components/simple-player/combatView';
import type { InitiativeEntry } from '@/types/initiative';

function entry(
  id: string,
  overrides: Partial<InitiativeEntry> = {},
): InitiativeEntry {
  return {
    id,
    name: id,
    type: 'monster',
    initiative: 10,
    maxHP: 12,
    currentHP: 9,
    tempHP: 0,
    armorClass: 12,
    conditions: [],
    isActive: false,
    isReady: false,
    isDelayed: false,
    notes: '',
    deathSaves: { successes: 0, failures: 0 },
    initiativeModifier: 0,
    dexterityModifier: 0,
    ...overrides,
  };
}

const entries = [
  entry('aria', {
    type: 'player',
    characterId: 'c1',
    currentHP: 15,
    maxHP: 20,
  }),
  entry('goblin', { tokenId: 't-visible' }),
  entry('lurker', { tokenId: 't-hidden' }),
  entry('bram', { type: 'player', playerId: 'p2' }),
];

function input(
  overrides: Partial<BuildSimpleCombatViewInput> = {},
): BuildSimpleCombatViewInput {
  return {
    isActive: true,
    round: 2,
    entries,
    activeEntryId: 'aria',
    userId: 'p1',
    characterOwners: new Map([['c1', 'p1']]),
    hiddenTokenIds: new Set(['t-hidden']),
    ...overrides,
  };
}

describe('buildSimpleCombatView', () => {
  it('filters hidden combatants and exposes HP only for players', () => {
    const view = buildSimpleCombatView(input());
    expect(view.combatants.map((c) => c.id)).toEqual([
      'aria',
      'goblin',
      'bram',
    ]);
    expect(view.combatants[0]).toMatchObject({
      isMine: true,
      isActive: true,
      hpLabel: '15/20',
    });
    expect(view.combatants[1].hpLabel).toBeUndefined();
  });

  it('marks my turn and the next visible combatant', () => {
    const view = buildSimpleCombatView(input());
    expect(view).toMatchObject({
      isInCombat: true,
      isMyTurn: true,
      activeLabel: 'aria',
      upNextLabel: 'goblin',
      myCombatantId: 'aria',
    });
  });

  it('skips hidden combatants for "up next" and wraps around', () => {
    expect(
      buildSimpleCombatView(input({ activeEntryId: 'goblin' })).upNextLabel,
    ).toBe('bram');
    expect(
      buildSimpleCombatView(input({ activeEntryId: 'bram' })).upNextLabel,
    ).toBe('aria');
  });

  it('hides the name of an active hidden combatant', () => {
    const view = buildSimpleCombatView(input({ activeEntryId: 'lurker' }));
    expect(view.activeLabel).toBe(HIDDEN_TURN_LABEL);
    expect(view.isMyTurn).toBe(false);
  });

  it('recognises entries owned directly by playerId', () => {
    const view = buildSimpleCombatView(
      input({ userId: 'p2', activeEntryId: 'bram' }),
    );
    expect(view.isMyTurn).toBe(true);
  });

  it('reports no combat when initiative is inactive', () => {
    const view = buildSimpleCombatView(input({ isActive: false }));
    expect(view).toMatchObject({
      isInCombat: false,
      isMyTurn: false,
      myCombatantId: 'aria',
    });
    expect(view.activeLabel).toBeUndefined();
  });

  it('handles an unknown active entry', () => {
    const view = buildSimpleCombatView(input({ activeEntryId: null }));
    expect(view.activeLabel).toBeUndefined();
    expect(view.upNextLabel).toBeUndefined();
    expect(view.isMyTurn).toBe(false);
  });
});
