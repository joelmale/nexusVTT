import { describe, expect, it } from 'vitest';
import { creationDataToDraft } from '../adapters/draftAdapter';
import { createdCharacterToNexus } from '../adapters/nexusCharacter';
import {
  evaluateDraft,
  toCharacterCreationResult,
} from '../services/draftEvaluator';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';

/**
 * Tranche T-04 batch D. Expected literals come from SRD 5.1 (Paladin, Ranger,
 * Half-Orc, Acolyte) and SRD 5.2.1 (Paladin p48, Ranger p57, Soldier, Criminal,
 * Elf), not from evaluator output. They await independent human review.
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
const resource = (saved: { resources?: Array<{ id: string }> }, id: string) =>
  saved.resources?.find((entry) => entry.id === id);
const hasSlots = (saved: { spellcasting?: { spellSlots?: number[] } }) =>
  (saved.spellcasting?.spellSlots ?? []).some((count) => count > 0);

describe('Paladin and Ranger reference records', () => {
  it.each(['PL14', 'PL24', 'RG14', 'RG24'])(
    '%s has no validation errors',
    (id) => {
      expect(
        build(id).evaluation.issues.filter(
          (issue) => issue.severity === 'error',
        ),
      ).toEqual([]);
      expect(build(id).saved.hitDice).toMatchObject({ max: 1, dieType: 10 });
    },
  );

  describe('spellcasting begins at level one in 2024 and level two in 2014', () => {
    it.each(['PL14', 'RG14'])('%s has no slots or prepared spells', (id) => {
      const { saved } = build(id);
      expect(hasSlots(saved)).toBe(false);
      expect(saved.spellcasting?.preparedSpells ?? []).toEqual([]);
      expect(saved.castingSources ?? []).toEqual([]);
    });

    it.each(['PL24', 'RG24'])(
      '%s has two level-1 slots and two prepared spells',
      (id) => {
        const { saved } = build(id);
        expect(saved.spellcasting.spellSlots[1]).toBe(2);
        expect(saved.spellcasting.preparedSpells).toHaveLength(2);
        expect(saved.spellcasting.cantripsKnown).toEqual([]);
      },
    );

    it('uses Charisma for Paladins and Wisdom for Rangers', () => {
      expect(build('PL24').saved.spellcasting.ability).toBe('CHA');
      expect(build('RG24').saved.spellcasting.ability).toBe('WIS');
    });
  });

  describe('class resources', () => {
    it.each(['PL14', 'PL24'])('%s Lay On Hands is a pool of five', (id) => {
      expect(resource(build(id).saved, 'lay-on-hands')).toMatchObject({
        maxUses: 5, // five times Paladin level
        currentUses: 5,
        rechargeType: 'long-rest',
        recovery: { longRest: 'full' },
      });
    });

    it('PL14 Divine Sense equals one plus the Charisma modifier', () => {
      expect(resource(build('PL14').saved, 'divine-sense')).toMatchObject({
        maxUses: 3, // 1 + CHA +2
        currentUses: 3,
        rechargeType: 'long-rest',
      });
      // SRD 5.2.1 removed Divine Sense from the Paladin.
      expect(resource(build('PL24').saved, 'divine-sense')).toBeUndefined();
    });

    it('RG24 Favored Enemy is two free Hunter’s Mark casts', () => {
      const { saved } = build('RG24');
      expect(resource(saved, 'favored-enemy')).toMatchObject({
        maxUses: 2,
        currentUses: 2,
        rechargeType: 'long-rest',
      });
      expect(
        saved.castingSources.find(
          (entry: { id: string }) => entry.id === 'class:ranger:favored-enemy',
        ),
      ).toMatchObject({
        ability: 'WIS',
        preparedSpells: ["hunter's-mark"],
        freeUses: 2,
      });
    });

    it('RG14 tracks no resources before spellcasting', () => {
      expect(build('RG14').saved.resources ?? []).toEqual([]);
    });
  });

  it('keeps Hunter’s Mark out of the two prepared Ranger spells', () => {
    expect(build('RG24').saved.spellcasting.preparedSpells).toEqual([
      'cure-wounds',
      'goodberry',
    ]);
  });

  it('RG24 keeps the Wood Elf lineage cantrip in its own ledger', () => {
    expect(
      build('RG24').saved.castingSources.find(
        (entry: { id: string }) => entry.id === 'species:elf:wood-elf',
      ),
    ).toMatchObject({ cantrips: ['druidcraft'], ability: 'WIS' });
    expect(build('RG24').saved.spellcasting.cantripsKnown).toEqual([]);
  });

  describe('proficiencies and masteries', () => {
    it('Paladins are proficient with all armor and martial weapons', () => {
      for (const id of ['PL14', 'PL24']) {
        const { saved } = build(id);
        expect(saved.proficiencies.armor.join(' ')).toMatch(/all armor/i);
        expect(saved.proficiencies.weapons).toEqual([
          'Simple Weapons',
          'Martial Weapons',
        ]);
      }
    });

    it('Rangers wear light and medium armor and shields only', () => {
      for (const id of ['RG14', 'RG24'])
        expect(build(id).saved.proficiencies.armor).toEqual([
          'Light Armor',
          'Medium Armor',
          'Shields',
        ]);
    });

    it('records the chosen weapon masteries for 2024', () => {
      expect(build('PL24').saved.weaponMastery).toEqual([
        'Longsword',
        'Javelin',
      ]);
      expect(build('RG24').saved.weaponMastery).toEqual([
        'Longbow',
        'Scimitar',
      ]);
    });
  });

  describe('equipment', () => {
    it('PL14 and PL24 equip chain mail, shield and longsword', () => {
      for (const id of ['PL14', 'PL24']) {
        const { saved } = build(id);
        const equipped = saved.inventory
          .filter((item: { equipped: boolean }) => item.equipped)
          .map((item: { equipmentSlug: string }) => item.equipmentSlug);
        expect(equipped).toEqual(
          expect.arrayContaining(['chain-mail', 'shield', 'longsword']),
        );
        expect(saved.armorClass).toBe(18);
      }
      expect(quantities(build('PL14').saved).javelin).toBe(5);
      expect(quantities(build('PL24').saved).javelin).toBe(6);
    });

    it('RG24 package A equips studded leather and a scimitar', () => {
      const q = quantities(build('RG24').saved);
      expect(q).toMatchObject({
        'studded-leather-armor': 1,
        scimitar: 1,
        shortsword: 1,
        longbow: 1,
        arrow: 20,
        quiver: 1,
        dagger: 2, // Criminal kit
        'thieves-tools': 1,
      });
    });

    it('RG14 keeps the SRD 5.1 Explorer’s Pack beside its two shortswords', () => {
      const q = quantities(build('RG14').saved);
      expect(q).toMatchObject({
        shortsword: 2,
        longbow: 1,
        arrow: 20,
        'mess-kit': 1,
        torch: 10,
      });
    });

    it('PL24 and RG24 use the SRD 5.2.1 Priest’s and Explorer’s Packs', () => {
      expect(quantities(build('PL24').saved)).toMatchObject({
        'holy-water': 1,
        lamp: 1,
        'rations-1-day': 7,
      });
      expect(quantities(build('RG24').saved)).toMatchObject({
        'oil-flask': 2,
        rope: 1,
      });
    });
  });

  // The Soldier background offers a choice of gaming set. The creator saves the
  // placeholder "Gaming Set (choose one)" rather than the player's choice, so a
  // chosen set is never recorded. Tracked as an open defect.
  it.todo('records the Soldier background gaming set that the player chose');
});
