/**
 * Regression cover for the guided (personality-led) flow's hand-off.
 *
 * The guided flow lets a player pick a background by its display name
 * ("Noble"), but every downstream consumer — `calculateCharacterStats` above
 * all — looks backgrounds up by slug ("noble-2024"). Emitting the display name
 * made the calculator throw "Incomplete creation data." on every single
 * guided run, so the flow could never produce a character.
 */

import { describe, expect, it } from 'vitest';
import { BACKGROUNDS, getAllSpecies, loadClasses } from '../../services/dataService';
import { calculateCharacterStats } from '../../utils/characterCreationUtils';
import type { CharacterCreationData } from '../../types/dnd';

/** Mirrors the shape the guided flow assembles before handing off. */
const buildGuidedPayload = (background: string): CharacterCreationData => {
  const speciesSlug = getAllSpecies().find((s) => s.name === 'Human')?.slug;
  const classSlug = loadClasses().find((c) => c.name === 'Paladin')?.slug;

  return {
    name: 'Seraphine Vale',
    level: 1,
    speciesSlug: speciesSlug!,
    classSlug: classSlug!,
    abilities: { STR: 15, DEX: 10, CON: 14, INT: 8, WIS: 12, CHA: 13 },
    abilityScoreMethod: 'standard-array',
    background,
    alignment: 'Lawful Good',
    edition: '2024',
    selectedSkills: [],
    selectedMusicalInstruments: [],
    equipmentChoices: [],
    hpCalculationMethod: 'max',
    spellSelection: {
      selectedCantrips: [],
      knownSpells: [],
      preparedSpells: [],
    },
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  } as unknown as CharacterCreationData;
};

describe('guided creation hand-off', () => {
  it('every background display name resolves to a slug', () => {
    // The guided flow offers names; the mapping to slugs must be total,
    // otherwise some recommendations silently dead-end.
    for (const background of BACKGROUNDS) {
      expect(background.name, 'background is missing a name').toBeTruthy();
      expect(background.slug, `${background.name} is missing a slug`).toBeTruthy();
    }
  });

  it('produces a character when the background is passed as a slug', () => {
    const noble = BACKGROUNDS.find((bg) => bg.name === 'Noble');
    expect(noble).toBeDefined();

    const character = calculateCharacterStats(buildGuidedPayload(noble!.slug));

    expect(character.name).toBe('Seraphine Vale');
    expect(character.class).toBe('Paladin');
    expect(character.species).toBe('Human');
    expect(character.maxHitPoints).toBeGreaterThan(0);
  });

  it('applies 2024 background ability bonuses when backgroundAbilityChoices is provided', () => {
    const noble = BACKGROUNDS.find((bg) => bg.name === 'Noble');
    expect(noble).toBeDefined();

    const payload = buildGuidedPayload(noble!.slug);
    payload.backgroundAbilityChoices = {
      method: '2/1',
      bonuses: { STR: 2, CHA: 1 },
    };

    const character = calculateCharacterStats(payload);
    // Base was STR 15, CHA 13
    expect(character.abilities.STR.score).toBe(17);
    expect(character.abilities.STR.modifier).toBe(3);
    expect(character.abilities.CHA.score).toBe(14);
    expect(character.abilities.CHA.modifier).toBe(2);
  });

  it('accepts a background passed as a display name', () => {
    // calculateCharacterStats resolves backgrounds by slug or case-insensitive display name
    const character = calculateCharacterStats(buildGuidedPayload('Noble'));
    expect(character).toBeDefined();
    expect(character.background).toBe('Noble');
  });

  it('parses background coin strings into character currency and avoids unknown inventory items', () => {
    const acolyte = BACKGROUNDS.find((bg) => bg.name === 'Acolyte') || BACKGROUNDS[0];
    const payload = buildGuidedPayload(acolyte.slug);
    const character = calculateCharacterStats(payload);

    expect(character.inventory).toBeDefined();
    expect(character.currency).toBeDefined();

    const unknownCoinItems = character.inventory!.filter(
      (inv) => inv.equipmentSlug.includes('gp') && inv.equipmentSlug.startsWith('unknown'),
    );
    expect(unknownCoinItems).toHaveLength(0);
    expect(typeof character.currency!.gp).toBe('number');
    expect(character.currency!.gp).toBeGreaterThan(0);
  });
});

