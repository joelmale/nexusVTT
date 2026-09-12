import { describe, it, expect } from 'vitest';
import {
  normalizeCharacter,
  normalizeIsoTimestamp,
  normalizeSkillKey,
} from '@/utils/characterNormalization';
import { createEmptyCharacter } from '@/types/character';

const NOW = '2026-01-01T00:00:00.000Z';

describe('characterNormalization', () => {
  it('normalizes skill keys', () => {
    expect(normalizeSkillKey('AnimalHandling')).toBe('Animal Handling');
    expect(normalizeSkillKey('SleightOfHand')).toBe('Sleight of Hand');
    expect(normalizeSkillKey('Arcana')).toBe('Arcana');
  });

  it('normalizes timestamps', () => {
    expect(normalizeIsoTimestamp('2025-01-01T00:00:00.000Z', NOW)).toBe(
      '2025-01-01T00:00:00.000Z',
    );
    expect(normalizeIsoTimestamp(0, NOW)).toBe('1970-01-01T00:00:00.000Z');
    expect(normalizeIsoTimestamp(undefined, NOW)).toBe(NOW);
  });

  it('normalizes characters and derives defaults', () => {
    const base = createEmptyCharacter('base-player');
    const input = {
      ...base,
      id: 'char-1',
      name: 'Test Character',
      level: 2,
      abilities: {
        ...base.abilities,
        STR: { score: 15, modifier: 0 },
        DEX: { score: 12, modifier: 0 },
      },
      skills: {
        ...base.skills,
        SleightOfHand: { proficient: true, expertise: true, value: 7 },
      },
      hitPoints: 8,
      maxHitPoints: 10,
      createdAt: undefined,
      updatedAt: undefined,
      playerId: '',
    } as typeof base;

    const normalized = normalizeCharacter(input, {
      playerId: 'player-1',
      now: NOW,
    });

    expect(normalized.playerId).toBe('player-1');
    expect(normalized.abilities.STR.modifier).toBe(2);
    expect(normalized.abilities.DEX.modifier).toBe(1);
    expect(normalized.skills['Sleight of Hand']).toEqual({
      proficient: true,
      expertise: true,
      value: 7,
    });
    expect(normalized.hitPoints).toBe(8);
    expect(normalized.maxHitPoints).toBe(10);
    expect(normalized.createdAt).toBe(NOW);
    expect(normalized.updatedAt).toBe(NOW);
  });

  it('preserves savingThrowProficiencies from input', () => {
    const base = createEmptyCharacter('player-1');
    const input = {
      ...base,
      savingThrowProficiencies: {
        STR: true, DEX: false, CON: false,
        INT: false, WIS: false, CHA: false,
      },
    };

    const normalized = normalizeCharacter(input, { playerId: 'player-1', now: NOW });
    expect(normalized.savingThrowProficiencies?.STR).toBe(true);
    expect(normalized.savingThrowProficiencies?.DEX).toBe(false);
  });

  it('defaults savingThrowProficiencies to all false when absent', () => {
    const base = createEmptyCharacter('player-1');
    const inputWithout = { ...base, savingThrowProficiencies: undefined };

    const normalized = normalizeCharacter(inputWithout as typeof base, { playerId: 'player-1', now: NOW });
    expect(normalized.savingThrowProficiencies?.STR).toBe(false);
    expect(normalized.savingThrowProficiencies?.CHA).toBe(false);
  });
});
