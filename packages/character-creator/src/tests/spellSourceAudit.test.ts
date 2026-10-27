import { describe, expect, it } from 'vitest';
import source from './fixtures/srd521-spell-headings.json';
import legacySource from './fixtures/srd51-spell-headings.json';
import revisedCatalog from '../data/srd/2024/5e-SRD-spells.json';
import { loadSpells } from '../services/dataService';

// Expectations were extracted from official PDF headings, never from either catalog.
const identity = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
describe('revised spell source membership and heading facts', () => {
  it('matches the 319 legacy spell names against SRD 5.1 description headings', () => {
    expect(legacySource.revision).toBe('SRD 5.1');
    expect(legacySource.pdfSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(legacySource.spells).toHaveLength(319);
    expect(
      loadSpells('2014')
        .map((spell) => identity(spell.name))
        .sort(),
    ).toEqual(legacySource.spells.map((spell) => identity(spell.name)).sort());
  });
  it('matches all 339 official names, levels, schools and class lists in the loaded catalog', () => {
    expect(source.revision).toBe('SRD 5.2.1');
    expect(source.pdfSha256).toMatch(/^[a-f0-9]{64}$/);
    const loaded = loadSpells('2024');
    expect(loaded).toHaveLength(339);
    expect(
      new Set(source.spells.map((spell) => identity(spell.name))).size,
    ).toBe(339);
    for (const expected of source.spells) {
      const actual = loaded.find(
        (spell) => identity(spell.name) === identity(expected.name),
      );
      expect(actual, expected.name).toBeDefined();
      expect(
        {
          level: actual!.level,
          school: actual!.school.toLowerCase(),
          classes: [...actual!.classes].sort(),
        },
        expected.name,
      ).toEqual({
        level: expected.level,
        school: expected.school,
        classes: expected.classes,
      });
    }
  });
  it('keeps the raw revised source synchronized with the same independently extracted facts', () => {
    expect(revisedCatalog).toHaveLength(source.spells.length);
    for (const expected of source.spells) {
      const actual = revisedCatalog.find(
        (spell) => identity(spell.name) === identity(expected.name),
      );
      expect(actual, expected.name).toBeDefined();
      expect(
        {
          level: actual!.level,
          school: actual!.school,
          classes: [...actual!.classes].sort(),
        },
        expected.name,
      ).toEqual({
        level: expected.level,
        school: expected.school,
        classes: expected.classes,
      });
    }
  });
});
