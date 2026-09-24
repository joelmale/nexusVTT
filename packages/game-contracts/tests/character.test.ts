import { describe, it, expect } from 'vitest';
import { characterRecordSchema } from '../src';
import { mockMartialCharacter } from './fixtures';

describe('CharacterRecord Schema', () => {
  it('validates a complete martial character record', () => {
    const parsed = characterRecordSchema.parse(mockMartialCharacter);
    expect(parsed.name).toBe('Valeros the Fighter');
    expect(parsed.level).toBe(5);
    expect(parsed.abilities.STR.score).toBe(18);
    expect(parsed.abilities.STR.modifier).toBe(4);
    expect(parsed.features).toHaveLength(1);
    expect(parsed.features[0].id).toBe('second-wind');
  });

  it('rejects character record with invalid ability scores or level', () => {
    expect(() =>
      characterRecordSchema.parse({
        ...mockMartialCharacter,
        level: 0,
      }),
    ).toThrow();

    expect(() =>
      characterRecordSchema.parse({
        ...mockMartialCharacter,
        level: 21,
      }),
    ).toThrow();

    expect(() =>
      characterRecordSchema.parse({
        ...mockMartialCharacter,
        abilities: {
          ...mockMartialCharacter.abilities,
          STR: { score: 35, modifier: 12 }, // max 30 in 5e
        },
      }),
    ).toThrow();
  });
});
