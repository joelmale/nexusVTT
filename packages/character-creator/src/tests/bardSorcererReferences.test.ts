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
 * Tranche T-04 batch B. Expected literals come from SRD 5.1 and SRD 5.2.1
 * (Bard p31-32 / Sorcerer p64-65 tables, species, backgrounds, packs), not
 * from evaluator output. They await independent human review.
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

describe('Bard and Sorcerer reference records', () => {
  it.each(['BD14', 'BD24', 'SC14', 'SC24'])(
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
    ['BD14', 8, 2, 2],
    ['BD24', 8, 2, 2],
    ['SC14', 6, 4, 2],
    ['SC24', 6, 4, 2],
  ])(
    '%s: d%i hit die, %i cantrips, %i level-1 slots',
    (id, die, cantrips, slots) => {
      const { saved } = build(id);
      expect(saved.hitDice).toMatchObject({ current: 1, max: 1, dieType: die });
      expect(saved.spellcasting.cantripsKnown).toHaveLength(cantrips);
      expect(saved.spellcasting.spellSlots[1]).toBe(slots);
      expect(saved.spellcasting.ability).toBe('CHA');
    },
  );

  it('2014 casters record known spells; 2024 casters record prepared spells', () => {
    expect(build('BD14').saved.spellcasting.spellcastingType).toBe('known');
    expect(build('BD14').saved.spellcasting.spellsKnown).toEqual([
      'cure-wounds',
      'faerie-fire',
      'healing-word',
      'thunderwave',
    ]);
    expect(build('SC14').saved.spellcasting.spellsKnown).toEqual([
      'shield',
      'magic-missile',
    ]);
    expect(build('BD24').saved.spellcasting.preparedSpells).toEqual([
      'healing-word',
      'dissonant-whispers',
      'faerie-fire',
      'heroism',
    ]);
    expect(build('SC24').saved.spellcasting.preparedSpells).toEqual([
      'burning-hands',
      'detect-magic',
    ]);
  });

  it.each(['BD14', 'BD24'])(
    '%s Bardic Inspiration equals the Charisma modifier and returns on a Long Rest',
    (id) => {
      const resource = build(id).saved.resources.find(
        (entry: { id: string }) => entry.id === 'bardic-inspiration',
      );
      expect(resource).toMatchObject({
        maxUses: 2, // Charisma +2, minimum 1
        currentUses: 2,
        rechargeType: 'long-rest',
        recovery: { longRest: 'full' },
      });
    },
  );

  it('SC24 Innate Sorcery has two uses and SC14 has no sorcery points yet', () => {
    expect(
      build('SC24').saved.resources.find(
        (entry: { id: string }) => entry.id === 'innate-sorcery',
      ),
    ).toMatchObject({ maxUses: 2, currentUses: 2, rechargeType: 'long-rest' });
    // Font of Magic and Sorcery Points begin at level 2 in both editions.
    expect(build('SC14').saved.resources ?? []).toEqual([]);
  });

  it('keeps the SRD 5.1 and 5.2.1 Entertainer’s Packs distinct', () => {
    expect(quantities(build('BD14').saved)).toMatchObject({
      costume: 2,
      candle: 5,
      'rations-1-day': 5,
      'disguise-kit': 1,
    });
    const modern = quantities(build('BD24').saved);
    expect(modern).toMatchObject({
      bell: 1,
      'bullseye-lantern': 1,
      costume: 3,
      mirror: 1,
      'oil-flask': 8,
      'rations-1-day': 9,
    });
    expect(modern['disguise-kit']).toBeUndefined();
  });

  it('SC24 keeps lineage, feat and class casting in separate ledgers', () => {
    const { saved } = build('SC24');
    const byId = (id: string) =>
      saved.castingSources.find((source: { id: string }) => source.id === id);
    expect(byId('species:gnome:forest')).toMatchObject({
      ability: 'CHA',
      cantrips: ['minor-illusion'],
      preparedSpells: ['speak-with-animals'],
      freeUses: 2, // Proficiency Bonus
    });
    expect(byId('feat:magic-initiate:wizard')).toMatchObject({
      cantrips: ['mage-hand', 'ray-of-frost'],
      preparedSpells: ['shield'],
      freeUses: 1,
    });
    // Class cantrips stay at the Sorcerer's four.
    expect(saved.spellcasting.cantripsKnown).toEqual([
      'light',
      'prestidigitation',
      'shocking-grasp',
      'sorcerous-burst',
    ]);
  });

  it('derives the Gnomish Lineage casting source without a saved copy', () => {
    const base = REFERENCE_BUILDS.SC24.creationData;
    const forest = resolveCastingGrants({
      ...base,
      additionalCastingSources: [],
    }).find((grant) => grant.source.id === 'species:gnome:forest');
    expect(forest?.source).toMatchObject({
      ability: 'CHA', // highest of INT/WIS/CHA when none is chosen
      cantrips: ['minor-illusion'],
      preparedSpells: ['speak-with-animals'],
      freeUses: 2,
    });
    const rock = resolveCastingGrants({
      ...base,
      selectedLineage: 'rock-gnome',
      additionalCastingSources: [],
    }).find((grant) => grant.source.id === 'species:gnome:rock');
    expect(rock?.source).toMatchObject({
      cantrips: ['mending', 'prestidigitation'],
      preparedSpells: [],
    });
    // Proficiency Bonus grows with level.
    expect(
      resolveCastingGrants({
        ...base,
        level: 5,
        additionalCastingSources: [],
      }).find((grant) => grant.source.id === 'species:gnome:forest')?.source
        .freeUses,
    ).toBe(3);
  });

  it('SC14 Draconic Resilience and the Rock Gnome speed apply together', () => {
    const { saved } = build('SC14');
    expect(saved.maxHitPoints).toBe(9);
    expect(saved.armorClass).toBe(14);
    expect(saved.speed).toBe(25);
  });
});
