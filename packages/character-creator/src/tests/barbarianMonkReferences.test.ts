import { describe, expect, it } from 'vitest';
import { creationDataToDraft } from '../adapters/draftAdapter';
import { createdCharacterToNexus } from '../adapters/nexusCharacter';
import {
  evaluateDraft,
  toCharacterCreationResult,
} from '../services/draftEvaluator';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';

/**
 * Tranche T-04 batch A. Expected literals below come from SRD 5.1 and SRD
 * 5.2.1 (class tables, species, backgrounds, pack contents), not from
 * evaluator output; see the notes in fixtures/referenceBuilds.ts. They await
 * independent human review.
 */
const build = (id: string) => {
  const oracle = REFERENCE_BUILDS[id];
  const evaluation = evaluateDraft(creationDataToDraft(oracle.creationData));
  const character = toCharacterCreationResult(evaluation).character;
  // Round-trip through JSON the way persistence does.
  const saved = JSON.parse(JSON.stringify(createdCharacterToNexus(character)));
  return { evaluation, character, saved };
};
const quantities = (saved: {
  inventory?: Array<{ equipmentSlug?: string; quantity: number }>;
}) =>
  Object.fromEntries(
    (saved.inventory ?? []).map((item) => [item.equipmentSlug, item.quantity]),
  );

describe('Barbarian and Monk reference records', () => {
  it.each(['B14', 'B24', 'M14', 'M24'])('%s has no validation errors', (id) => {
    const { evaluation } = build(id);
    expect(
      evaluation.issues.filter((issue) => issue.severity === 'error'),
    ).toEqual([]);
  });

  it.each([
    ['B14', 12],
    ['B24', 12],
    ['M14', 8],
    ['M24', 8],
  ])('%s hit die is d%i at level one', (id, die) => {
    const { character } = build(id);
    expect(character.hitDice).toMatchObject({
      current: 1,
      max: 1,
      dieType: die,
    });
    expect(character.proficiencyBonus).toBe(2);
  });

  it.each(['B14', 'B24'])('%s starts with two full Rage uses', (id) => {
    const rage = build(id).saved.resources.find(
      (resource: { id: string }) => resource.id === 'rage',
    );
    expect(rage).toMatchObject({ maxUses: 2, currentUses: 2 });
  });

  it('Rage recovery follows each edition', () => {
    const rage = (id: string) =>
      build(id).saved.resources.find(
        (resource: { id: string }) => resource.id === 'rage',
      );
    // SRD 5.1: all expended uses return on a Long Rest only.
    expect(rage('B14').rechargeType).toBe('long-rest');
    expect(rage('B14').recovery?.shortRest).toBeUndefined();
    // SRD 5.2.1 p28: one use on a Short Rest, all on a Long Rest.
    expect(rage('B24').recovery).toEqual({ shortRest: 1, longRest: 'full' });
  });

  it.each(['M14', 'M24'])(
    '%s has no Ki or Focus resource before level two',
    (id) => {
      const { saved } = build(id);
      expect(saved.resources ?? []).toEqual([]);
    },
  );

  it('B14 keeps the SRD 5.1 weapon choices and background kit', () => {
    const { saved } = build('B14');
    expect(quantities(saved)).toMatchObject({
      greataxe: 1,
      handaxe: 2,
      javelin: 4,
      backpack: 1,
      'mess-kit': 1,
      'holy-symbol': 1,
      'prayer-book': 1,
      '5-sticks-of-incense': 1,
      vestments: 1,
      'common-clothes': 1,
    });
  });

  it('B24 keeps package A, the Criminal kit and chosen masteries', () => {
    const { character, saved } = build('B24');
    expect(quantities(saved)).toMatchObject({
      greataxe: 1,
      handaxe: 4,
      dagger: 2,
      'thieves-tools': 1,
      crowbar: 1,
      pouch: 2,
      "traveler's-clothes": 1,
    });
    expect(character.selectedFeats).toContain('alert');
    expect(
      (character as unknown as { weaponMastery?: string[] }).weaponMastery,
    ).toEqual(['Greataxe', 'Handaxe']);
  });

  it('2024 Explorer’s Pack follows SRD 5.2.1 and the 2014 pack follows SRD 5.1', () => {
    const modern = quantities(build('B24').saved);
    expect(modern).toMatchObject({
      backpack: 1,
      bedroll: 1,
      'oil-flask': 2,
      'rations-1-day': 10,
      rope: 1,
      tinderbox: 1,
      torch: 10,
      waterskin: 1,
    });
    expect(modern['mess-kit']).toBeUndefined();

    const legacy = quantities(build('M14').saved);
    expect(legacy).toMatchObject({
      dart: 10,
      backpack: 1,
      bedroll: 1,
      'mess-kit': 1,
      tinderbox: 1,
      torch: 10,
      'rations-1-day': 10,
      waterskin: 1,
      'hempen-rope-50-feet': 1,
    });
  });

  it('M24 keeps Monk package A and the Acolyte kit', () => {
    const { saved } = build('M24');
    expect(quantities(saved)).toMatchObject({
      spear: 1,
      dagger: 5,
      'calligrapher-supplies': 1,
      'holy-symbol': 1,
      robe: 1,
    });
  });

  it('M24 keeps Magic Initiate (Cleric) separate from class casting', () => {
    const { character, saved } = build('M24');
    // A Monk has no class spellcasting; the feat is its own casting source.
    expect(character.spellcasting?.spellSlots?.some(Boolean) ?? false).toBe(
      false,
    );
    const source = saved.castingSources.find(
      (entry: { id: string }) => entry.id === 'feat:magic-initiate:cleric',
    );
    expect(source).toMatchObject({
      ability: 'WIS',
      cantrips: ['guidance', 'sacred-flame'],
      preparedSpells: ['healing-word'],
      freeUses: 1,
    });
  });

  it('keeps unarmored defense when a shield or armor is absent', () => {
    // Armor class is 10 + DEX + CON (Barbarian) or 10 + DEX + WIS (Monk).
    for (const [id, ac] of [
      ['B14', 13],
      ['B24', 14],
      ['M14', 15],
      ['M24', 15],
    ] as const)
      expect(build(id).saved.armorClass).toBe(ac);
  });
});
