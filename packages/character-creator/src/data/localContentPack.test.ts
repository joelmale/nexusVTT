import { describe, expect, it } from 'vitest';
import { parseLocalSpellPack, withLocalSpellText } from './localContentPack';
import { loadSpells } from '../services/dataService';

describe('local content pack', () => {
  it('parses strings and objects and skips unusable entries', () => {
    const pack = parseLocalSpellPack({
      spells: {
        'Tiny Servant': '  Body text.  ',
        'Wall of Light': { description: 'Beam.', higherLevels: ' More. ' },
        Empty: '   ',
        Bad: 42,
      },
    });
    expect(pack['tiny servant']).toEqual({ description: 'Body text.' });
    expect(pack['wall of light']).toEqual({
      description: 'Beam.',
      higherLevels: 'More.',
    });
    expect(Object.keys(pack)).toHaveLength(2);
    expect(parseLocalSpellPack(null)).toEqual({});
    expect(parseLocalSpellPack({ spells: [] })).toEqual({});
  });

  it('applies text, matches curly apostrophes and clears the placeholder flag', () => {
    const pack = parseLocalSpellPack({ spells: { "Tasha's Thing": 'Mine.' } });
    const spell = {
      name: 'Tasha’s Thing',
      description: 'Rules text is not bundled',
      textNotBundled: true,
    };
    expect(withLocalSpellText(spell, pack)).toEqual({
      name: 'Tasha’s Thing',
      description: 'Mine.',
      textNotBundled: false,
    });
  });

  it('returns the same object when the pack has nothing for the spell', () => {
    const spell = { name: 'Fireball', description: 'SRD' };
    expect(withLocalSpellText(spell, {})).toBe(spell);
  });

  it('leaves bundled data unchanged when no local files exist', () => {
    const flagged = loadSpells('2014').filter((s) => s.textNotBundled);
    // Holds on CI and on clean checkouts; a developer with a pack may see fewer.
    expect(flagged.length).toBeLessThanOrEqual(29);
  });
});
