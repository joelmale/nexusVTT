import { describe, expect, it } from 'vitest';
import {
  featSpellChoiceFields,
  featSpellChoicesComplete,
  resolveFeatSpellChoice,
} from './featSpellChoices';

describe('feat spell choices', () => {
  it('lists only first-level divination and enchantment spells for Fey Touched', () => {
    const [field] = featSpellChoiceFields('fey-touched', '2024');
    expect(field.options.length).toBeGreaterThan(0);
    for (const spell of field.options) {
      expect(spell.level).toBe(1);
      expect(['divination', 'enchantment']).toContain(
        spell.school.toLowerCase(),
      );
    }
  });

  it('has no fields for a feat that fixes its spells', () => {
    expect(featSpellChoiceFields('lucky', '2024')).toEqual([]);
    expect(featSpellChoicesComplete('lucky', '2024', undefined)).toBe(true);
  });

  it('resolves only catalog spells that satisfy the rule', () => {
    expect(
      resolveFeatSpellChoice('2024', 'fey-touched', 'spell', 'charm-person'),
    ).toBe('charm-person');
    for (const wrong of ['shield', 'fire-bolt', 'nonsense', 42, undefined])
      expect(
        resolveFeatSpellChoice('2024', 'fey-touched', 'spell', wrong),
      ).toBeUndefined();
    expect(
      resolveFeatSpellChoice('2024', 'fey-touched', 'cantrip', 'charm-person'),
    ).toBeUndefined();
  });

  it('is complete only once every selectable field holds a legal choice', () => {
    expect(featSpellChoicesComplete('fey-touched', '2024', {})).toBe(false);
    expect(
      featSpellChoicesComplete('fey-touched', '2024', { spell: 'shield' }),
    ).toBe(false);
    expect(
      featSpellChoicesComplete('fey-touched', '2024', {
        spell: 'charm-person',
      }),
    ).toBe(true);
  });

  it('does not block a feat whose list is empty in the current catalog', () => {
    // The Artificer catalog is unverified and has no spells yet.
    for (const field of featSpellChoiceFields('artificer-initiate', '2024'))
      expect(field.options).toEqual([]);
    expect(featSpellChoicesComplete('artificer-initiate', '2024', {})).toBe(
      true,
    );
  });
});
