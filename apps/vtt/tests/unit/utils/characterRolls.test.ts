import { describe, expect, it } from 'vitest';
import type { Character, Weapon } from '@nexus/character-contracts';
import {
  abilityModifier,
  d20Expression,
  formatModifier,
  proficiencyBonus,
  savingThrowBonus,
  weaponAttacks,
  withModifier,
} from '@/utils/characterRolls';

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c1',
    name: 'Aria',
    level: 3,
    hitPoints: 20,
    proficiencyBonus: 2,
    abilities: {
      STR: { score: 16, modifier: 3 },
      DEX: { score: 14, modifier: 2 },
      CON: { score: 12, modifier: 1 },
      INT: { score: 10, modifier: 0 },
      WIS: { score: 8, modifier: -1 },
      CHA: { score: 10, modifier: 0 },
    },
    skills: {},
    savingThrowProficiencies: {
      STR: true,
      DEX: false,
      CON: true,
      INT: false,
      WIS: false,
      CHA: false,
    },
    ...overrides,
  } as Character;
}

const weapons: Weapon[] = [
  {
    id: 'longsword',
    name: 'Longsword',
    type: 'martial',
    category: 'melee',
    damage: '1d8',
    properties: ['versatile'],
  },
  {
    id: 'rapier',
    name: 'Rapier',
    type: 'martial',
    category: 'melee',
    damage: '1d8',
    properties: ['finesse'],
  },
  {
    id: 'shortbow',
    name: 'Shortbow',
    type: 'simple',
    category: 'ranged',
    damage: '1d6',
    properties: ['ammunition'],
  },
];

describe('characterRolls', () => {
  it('formats modifiers and expressions', () => {
    expect(formatModifier(3)).toBe('+3');
    expect(formatModifier(0)).toBe('+0');
    expect(formatModifier(-1)).toBe('-1');
    expect(d20Expression(5)).toBe('1d20+5');
    expect(d20Expression(-1)).toBe('1d20-1');
    expect(d20Expression(0)).toBe('1d20');
    expect(withModifier('1d8', 3)).toBe('1d8+3');
    expect(withModifier('1d8', 0)).toBe('1d8');
  });

  it('computes saves with proficiency, matching the full sheet', () => {
    const c = character();
    expect(savingThrowBonus(c, 'STR')).toBe(5);
    expect(savingThrowBonus(c, 'WIS')).toBe(-1);
    expect(
      savingThrowBonus(
        character({ savingThrowProficiencies: undefined }),
        'STR',
      ),
    ).toBe(3);
    expect(proficiencyBonus(character({ proficiencyBonus: undefined }))).toBe(
      2,
    );
  });

  it('defaults a missing ability modifier to zero', () => {
    const c = character({ abilities: {} as Character['abilities'] });
    expect(abilityModifier(c, 'STR')).toBe(0);
  });

  it('builds attacks for equipped weapons only', () => {
    const c = character({
      inventory: [
        { equipmentSlug: 'longsword', equipped: true, quantity: 1 },
        { equipmentSlug: 'srd-rapier', equipped: true, quantity: 1 },
        { equipmentSlug: 'bow', name: 'Shortbow', equipped: true, quantity: 1 },
        { equipmentSlug: 'longsword', equipped: false, quantity: 1 },
        { equipmentSlug: 'mystery-blade', equipped: true, quantity: 1 },
      ],
    });
    expect(weaponAttacks(c, weapons)).toEqual([
      { id: 'longsword', name: 'Longsword', toHit: 5, damage: '1d8+3' },
      { id: 'srd-rapier', name: 'Rapier', toHit: 5, damage: '1d8+3' },
      { id: 'bow', name: 'Shortbow', toHit: 4, damage: '1d6+2' },
    ]);
  });

  it('uses DEX for finesse when it is higher', () => {
    const c = character({
      abilities: {
        ...character().abilities,
        STR: { score: 8, modifier: -1 },
        DEX: { score: 18, modifier: 4 },
      },
      inventory: [{ equipmentSlug: 'rapier', equipped: true, quantity: 1 }],
    });
    expect(weaponAttacks(c, weapons)[0]).toMatchObject({
      toHit: 6,
      damage: '1d8+4',
    });
    expect(weaponAttacks(character(), weapons)).toEqual([]);
  });
});
