import { describe, expect, it } from 'vitest';
import { creationDataToDraft } from '../adapters/draftAdapter';
import { createdCharacterToNexus } from '../adapters/nexusCharacter';
import {
  evaluateDraft,
  toCharacterCreationResult,
} from '../services/draftEvaluator';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';

describe('fixed-input Warlock reference calculations', () => {
  it.each(['WL14', 'WL24'])(
    '%s survives evaluation and durable host serialization',
    (id) => {
      const oracle = REFERENCE_BUILDS[id];
      const evaluation = evaluateDraft(
        creationDataToDraft(oracle.creationData),
      );
      expect(
        evaluation.issues.filter((issue) => issue.severity === 'error'),
      ).toEqual([]);
      const result = toCharacterCreationResult(evaluation);
      const character = result.character;
      expect(
        Object.fromEntries(
          Object.entries(character.abilities).map(([ability, value]) => [
            ability,
            value.score,
          ]),
        ),
      ).toEqual(oracle.expected.abilities);
      expect(character.maxHitPoints).toBe(oracle.expected.hp);
      expect(character.armorClass).toBe(oracle.expected.ac);
      expect(character.initiative).toBe(oracle.expected.initiative);
      expect(character.speed).toBe(oracle.expected.speed);
      expect(character.proficiencyBonus).toBe(2);
      expect(character.hitDice).toMatchObject({
        current: 1,
        max: 1,
        dieType: 8,
      });
      expect(character.currency).toMatchObject(oracle.expected.currency!);
      expect(character.spellcasting).toMatchObject({
        spellAttackBonus: oracle.expected.spells!.spellAttackBonus,
        spellSaveDC: oracle.expected.spells!.spellSaveDC,
      });
      expect(character.spellcasting?.cantripsKnown).toHaveLength(2);
      expect(character.spellcasting?.spellSlots?.[1]).toBe(1);
      for (const [skill, expected] of Object.entries(oracle.expected.skills!)) {
        const actual = Object.entries(character.skills).find(
          ([name]) => name.toLowerCase().replace(/[^a-z]/g, '') === skill,
        )?.[1];
        expect(actual?.value).toBe(expected!.bonus);
      }
      const saved = JSON.parse(
        JSON.stringify(createdCharacterToNexus(character)),
      );
      expect(saved.armorClass).toBe(oracle.expected.ac);
      expect(saved.maxHitPoints).toBe(oracle.expected.hp);
      expect(saved.spellcasting).toEqual(character.spellcasting);
      expect(saved.inventory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            equipmentSlug: 'leather-armor',
            quantity: 1,
          }),
        ]),
      );
    },
  );
});
