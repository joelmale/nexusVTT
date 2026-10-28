import { describe, expect, it } from 'vitest';
import srdSpells2014 from './srd/2014/5e-SRD-Spells.json';
import srdSpells2024 from './srd/2024/5e-SRD-spells.json';
import { mergeSpellSources } from './mergeSpells';

type NamedSpell = { name?: string; level?: number };

describe('mergeSpellSources', () => {
  it('keeps the 2024 version of a spell present in both editions, in its first position', () => {
    const merged = mergeSpellSources(
      [
        { name: 'Alpha', level: 1, text: '2014' },
        { name: 'Beta', level: 2, text: '2014' },
      ],
      [
        { name: ' beta ', level: 2, text: '2024' },
        { name: 'Gamma', level: 3, text: '2024' },
      ],
    );
    expect(merged.map((spell) => [spell.name, spell.source])).toEqual([
      ['Alpha', '2014'],
      [' beta ', '2024'],
      ['Gamma', '2024'],
    ]);
  });

  it('skips entries without a name or level', () => {
    expect(mergeSpellSources([{ level: 1 }, { name: 'Nameless' }], [])).toEqual(
      [],
    );
  });

  it('merges the bundled SRD files into 341 spells: 339 from 2024 and 2 only in 2014', () => {
    const merged = mergeSpellSources(
      srdSpells2014 as NamedSpell[],
      srdSpells2024 as NamedSpell[],
    );
    expect(merged).toHaveLength(341);
    expect(merged.filter((spell) => spell.source === '2024')).toHaveLength(339);
    // Every 2024 spell appears exactly as the 2024 file defines it.
    const bySlug = new Map(merged.map((spell) => [spell.name, spell]));
    for (const spell of srdSpells2024)
      expect(bySlug.get(spell.name)).toEqual({ ...spell, source: '2024' });
  });
});
