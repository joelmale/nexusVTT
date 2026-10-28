import { describe, expect, it } from 'vitest';
import reference from '../tests/fixtures/artificerLegacyReference.json';
import { classSpellSlots } from '../utils/classSpellSlots';
import { loadSpells } from './dataService';

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

// SRD 5.1 prints these without the wizard's name.
const SRD_NAMES: Record<string, string> = {
  "leomund's secret chest": 'secret chest',
  "mordenkainen's faithful hound": 'faithful hound',
  "mordenkainen's private sanctum": 'private sanctum',
  "otiluke's resilient sphere": 'resilient sphere',
};

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

  it('shows which listed spells the bundled SRD catalog can resolve', () => {
    const missing = entries
      .filter((entry) => !entry.inCatalog)
      .map((entry) => entry.name);
    // These are Tasha's, Xanathar's, Fizban's, Spelljammer and UA spells that
    // the SRD does not contain. They cannot be added without a licensed source.
    expect(missing).toHaveLength(33);
    expect(missing).toEqual(
      expect.arrayContaining([
        "Tasha's Caustic Brew",
        'Booming Blade',
        'Summon Construct',
        'Absorb Elements',
      ]),
    );
    expect(entries.filter((entry) => entry.inCatalog)).toHaveLength(70);
  });

  it('keeps Artificer off every bundled spell list while the class is blocked', () => {
    const withArtificer = [...loadSpells('2014'), ...loadSpells('2024')].filter(
      (spell) => spell.classes.includes('artificer'),
    );
    expect(withArtificer).toEqual([]);
  });
});
