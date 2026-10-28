import { describe, expect, it } from 'vitest';
import reference from '../tests/fixtures/artificerLegacyReference.json';
import { classSpellSlots } from '../utils/classSpellSlots';
import { loadSpells } from './dataService';
import { ARTIFICER_SRD_ALIASES } from '../data/artificerLegacySpellList';

/**
 * The only Artificer source supplied to the project is a third-party
 * transcription of the legacy (Tasha's) class. These tests pin what that
 * reference establishes and make visible what the bundled catalog cannot
 * support yet. Canonical Artificer creation stays blocked until the
 * unresolved spells have a licensed source and the 2025 class is verified.
 */
const normalise = (name: string) =>
  name
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/\s*\(ua\)$/, '')
    .trim();

const SRD_NAMES = ARTIFICER_SRD_ALIASES;

describe('legacy Artificer reference', () => {
  it('slot progression matches the reference table at every level', () => {
    for (const [level, expected] of Object.entries(
      reference.spellSlotsByClassLevel,
    ))
      expect(
        classSpellSlots('artificer', '2014', Number(level)).slice(1, 6),
      ).toEqual(expected);
  });

  const catalog = new Set(
    loadSpells('2014').map((spell) => normalise(spell.name)),
  );
  const entries = Object.entries(reference.spellList).flatMap(
    ([level, names]) =>
      names.map((name) => ({
        level: Number(level),
        name,
        inCatalog: catalog.has(SRD_NAMES[normalise(name)] ?? normalise(name)),
      })),
  );

  it('records 103 listed spells, 3 of them Unearthed Arcana', () => {
    expect(entries).toHaveLength(103);
    expect(entries.filter((entry) => /\(UA\)/.test(entry.name))).toHaveLength(
      3,
    );
  });

  it('resolves every official listed spell to exactly one catalog entry', () => {
    const catalogEntries = loadSpells('2014');
    const official = entries.filter((entry) => !/\(UA\)/.test(entry.name));
    expect(official).toHaveLength(100);
    for (const entry of official) {
      const matches = catalogEntries.filter(
        (spell) =>
          normalise(spell.name) ===
          (SRD_NAMES[normalise(entry.name)] ?? normalise(entry.name)),
      );
      expect(matches, entry.name).toHaveLength(1);
      expect(matches[0].classes, entry.name).toContain('artificer');
      expect(matches[0].level, entry.name).toBe(entry.level);
    }
  });

  it('keeps the three Unearthed Arcana playtest spells out of the catalog', () => {
    const names = loadSpells('2014').map((spell) => normalise(spell.name));
    for (const playtest of ['arcane weapon', 'flame stride', 'house of cards'])
      expect(names).not.toContain(playtest);
  });

  it('bundles mechanics only for the 29 non-SRD spells, not their rules text', () => {
    const supplemental = loadSpells('2014').filter(
      (spell) => spell.textNotBundled,
    );
    expect(supplemental).toHaveLength(29);
    for (const spell of supplemental) {
      expect(spell.classes).toEqual(['artificer']);
      expect(spell.description).toMatch(/not bundled/i);
      expect(spell.description.length).toBeLessThan(100);
    }
  });

  it('gives the legacy Artificer list 100 spells and leaves 2024 spells alone', () => {
    expect(
      loadSpells('2014').filter((spell) => spell.classes.includes('artificer')),
    ).toHaveLength(100);
    // The revised 2025 Artificer is unverified, so no 2024 spell carries it.
    expect(
      loadSpells('2024').filter((spell) => spell.classes.includes('artificer')),
    ).toEqual([]);
  });
});
