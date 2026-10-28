import { describe, expect, it } from 'vitest';
import { creationDataToDraft } from '../adapters/draftAdapter';
import { createdCharacterToNexus } from '../adapters/nexusCharacter';
import {
  evaluateDraft,
  toCharacterCreationResult,
} from '../services/draftEvaluator';
import { resolveCastingGrants } from '../services/castingSources';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';

/**
 * Tranche T-04 batch C. Expected literals come from SRD 5.1 (Cleric, Druid,
 * Life Domain, Priest's and Explorer's Packs) and SRD 5.2.1 (Cleric p41-43,
 * Druid p53-54, Divine and Primal Order, packs), not from evaluator output.
 * They await independent human review.
 */
const build = (id: string) => {
  const oracle = REFERENCE_BUILDS[id];
  const evaluation = evaluateDraft(creationDataToDraft(oracle.creationData));
  const character = toCharacterCreationResult(evaluation).character;
  const saved = JSON.parse(JSON.stringify(createdCharacterToNexus(character)));
  return { evaluation, character, saved };
};
const quantities = (saved: {
  inventory?: Array<{ equipmentSlug?: string; quantity: number }>;
}) =>
  Object.fromEntries(
    (saved.inventory ?? []).map((item) => [item.equipmentSlug, item.quantity]),
  );
const source = (saved: { castingSources: Array<{ id: string }> }, id: string) =>
  saved.castingSources.find((entry) => entry.id === id);

describe('Cleric and Druid reference records', () => {
  it.each(['CL14', 'CL24', 'DR14', 'DR24'])(
    '%s has no validation errors',
    (id) => {
      expect(
        build(id).evaluation.issues.filter(
          (issue) => issue.severity === 'error',
        ),
      ).toEqual([]);
    },
  );

  it.each([
    ['CL14', 3, 2],
    ['CL24', 4, 2],
    ['DR14', 2, 2],
    ['DR24', 3, 2],
  ])(
    '%s: %i cantrips and %i level-1 slots, Wisdom casting',
    (id, cantrips, slots) => {
      const { saved } = build(id);
      expect(saved.spellcasting.cantripsKnown).toHaveLength(cantrips);
      expect(saved.spellcasting.spellSlots[1]).toBe(slots);
      expect(saved.spellcasting.ability).toBe('WIS');
      expect(saved.hitDice).toMatchObject({ max: 1, dieType: 8 });
    },
  );

  it.each(['CL14', 'CL24', 'DR14', 'DR24'])(
    '%s has no Channel Divinity or Wild Shape resource before level two',
    (id) => {
      expect(build(id).saved.resources ?? []).toEqual([]);
    },
  );

  describe('2014 Life Domain', () => {
    it('grants heavy armor proficiency', () => {
      expect(build('CL14').saved.proficiencies.armor).toContain('Heavy armor');
    });

    it('keeps domain spells separate from the four prepared spells', () => {
      const { saved } = build('CL14');
      expect(saved.spellcasting.preparedSpells).toEqual([
        'healing-word',
        'guiding-bolt',
        'shield-of-faith',
        'sanctuary',
      ]);
      expect(source(saved, 'class:cleric:life-domain')).toMatchObject({
        ability: 'WIS',
        preparedSpells: ['bless', 'cure-wounds'],
      });
    });

    it('adds domain spells at the SRD 5.1 Cleric levels', () => {
      const base = REFERENCE_BUILDS.CL14.creationData;
      const prepared = (level: number) =>
        resolveCastingGrants({ ...base, level }).find(
          (grant) => grant.source.id === 'class:cleric:life-domain',
        )?.source.preparedSpells;
      expect(prepared(2)).toEqual(['bless', 'cure-wounds']);
      expect(prepared(3)).toEqual([
        'bless',
        'cure-wounds',
        'lesser-restoration',
        'spiritual-weapon',
      ]);
      expect(prepared(9)).toHaveLength(10);
    });

    it('does not apply to other Clerics or editions', () => {
      const base = REFERENCE_BUILDS.CL14.creationData;
      expect(
        resolveCastingGrants({ ...base, subclassSlug: null }).some(
          (grant) => grant.source.id === 'class:cleric:life-domain',
        ),
      ).toBe(false);
      expect(
        resolveCastingGrants(REFERENCE_BUILDS.CL24.creationData).some(
          (grant) => grant.source.id === 'class:cleric:life-domain',
        ),
      ).toBe(false);
    });

    it('wears and equips the chosen chain mail and shield', () => {
      const { saved } = build('CL14');
      const equipped = saved.inventory
        .filter((item: { equipped: boolean }) => item.equipped)
        .map((item: { equipmentSlug: string }) => item.equipmentSlug);
      expect(equipped).toEqual(
        expect.arrayContaining(['mace', 'chain-mail', 'shield']),
      );
      expect(saved.armorClass).toBe(18);
    });
  });

  describe('2024 Divine and Primal Order', () => {
    it('Thaumaturge adds a cantrip and records the order', () => {
      const { saved } = build('CL24');
      expect(saved.divineOrder).toBe('thaumaturge');
      expect(saved.spellcasting.cantripsKnown).toEqual([
        'guidance',
        'light',
        'sacred-flame',
        'thaumaturgy',
      ]);
      // Thaumaturge grants no extra armor or weapon training.
      expect(saved.proficiencies.armor).toEqual([
        'Light Armor',
        'Medium Armor',
        'Shields',
      ]);
      expect(saved.proficiencies.armor).not.toContain('Heavy armor');
    });

    it('Magician adds a cantrip and does not grant Warden training', () => {
      const { saved } = build('DR24');
      expect(saved.primalOrder).toBe('magician');
      expect(saved.proficiencies.armor).toEqual(['Light Armor', 'Shields']);
      expect(saved.proficiencies.weapons).toEqual(['Simple Weapons']);
    });
  });

  it('DR24 keeps Druidic, lineage and feat casting in separate ledgers', () => {
    const { saved } = build('DR24');
    expect(source(saved, 'class:druid:druidic')).toMatchObject({
      preparedSpells: ['speak-with-animals'],
    });
    expect(source(saved, 'species:elf:drow')).toMatchObject({
      cantrips: ['dancing-lights'],
    });
    expect(source(saved, 'feat:magic-initiate:cleric')).toMatchObject({
      cantrips: ['guidance', 'sacred-flame'],
      preparedSpells: ['cure-wounds'],
      freeUses: 1,
    });
    // Class cantrips stay at the Druid's two plus the Magician cantrip.
    expect(saved.spellcasting.cantripsKnown).toEqual([
      'druidcraft',
      'shillelagh',
      'produce-flame',
    ]);
  });

  it('CL24 keeps Magic Initiate (Wizard) separate with its own ability', () => {
    expect(
      source(build('CL24').saved, 'feat:magic-initiate:wizard'),
    ).toMatchObject({
      ability: 'INT',
      cantrips: ['mage-hand', 'fire-bolt'],
      preparedSpells: ['shield'],
    });
  });

  it('DR14 follows the SRD 5.1 Druid proficiency list', () => {
    const { saved } = build('DR14');
    expect(saved.proficiencies.tools).toContain('Herbalism Kit');
    expect(saved.proficiencies.weapons).toEqual(
      expect.arrayContaining(['Scimitars', 'Sickles', 'Quarterstaffs']),
    );
    expect(saved.proficiencies.armor).not.toContain('Heavy armor');
  });

  it('keeps each edition’s Priest’s and Explorer’s Packs distinct', () => {
    const legacyCleric = quantities(build('CL14').saved);
    expect(legacyCleric).toMatchObject({
      candle: 10,
      'alms-box': 1,
      'block-of-incense': 2,
      censer: 1,
      'rations-1-day': 2,
    });
    const modernCleric = quantities(build('CL24').saved);
    expect(modernCleric).toMatchObject({
      'holy-water': 1,
      lamp: 1,
      'rations-1-day': 7,
      blanket: 1,
    });
    expect(modernCleric.candle).toBeUndefined();
    expect(quantities(build('DR14').saved)).toMatchObject({
      'mess-kit': 1,
      torch: 10,
    });
    const modernDruid = quantities(build('DR24').saved);
    expect(modernDruid).toMatchObject({ 'oil-flask': 2, rope: 1, torch: 10 });
    expect(modernDruid['mess-kit']).toBeUndefined();
  });
});
