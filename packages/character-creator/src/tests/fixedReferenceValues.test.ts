import { describe, expect, it } from 'vitest';
import { creationDataToDraft } from '../adapters/draftAdapter';
import { createdCharacterToNexus } from '../adapters/nexusCharacter';
import {
  evaluateDraft,
  toCharacterCreationResult,
} from '../services/draftEvaluator';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';

describe('independent fixed reference values survive host serialization', () => {
  it.each(Object.values(REFERENCE_BUILDS))(
    '$id preserves numeric values, skills and saving throw proficiencies',
    (oracle) => {
      const evaluation = evaluateDraft(
        creationDataToDraft(oracle.creationData),
      );
      expect(
        evaluation.issues.filter((issue) => issue.severity === 'error'),
      ).toEqual([]);
      const character = toCharacterCreationResult(evaluation).character;
      const saved = createdCharacterToNexus(character);
      expect(saved.maxHitPoints).toBe(oracle.expected.hp);
      expect(saved.armorClass).toBe(oracle.expected.ac);
      expect(saved.initiative).toBe(oracle.expected.initiative);
      expect(saved.speed).toBe(oracle.expected.speed);
      expect(saved.currency).toMatchObject(oracle.expected.currency!);
      expect(
        Object.entries(saved.savingThrowProficiencies ?? {})
          .filter(([, proficient]) => proficient)
          .map(([ability]) => ability)
          .sort(),
      ).toEqual(oracle.expected.saves.proficient.slice().sort());
      for (const [ability, bonus] of Object.entries(
        oracle.expected.saves.bonuses,
      )) {
        const key = ability as keyof typeof saved.abilities;
        expect(
          saved.abilities[key].modifier +
            (saved.savingThrowProficiencies?.[key]
              ? (saved.proficiencyBonus ?? 0)
              : 0),
        ).toBe(bonus);
      }
      for (const [ability, expected] of Object.entries(
        oracle.expected.abilities,
      ))
        expect(
          saved.abilities[ability as keyof typeof saved.abilities].score,
        ).toBe(expected);
      for (const [skill, expected] of Object.entries(
        oracle.expected.skills ?? {},
      )) {
        const actual = Object.entries(saved.skills).find(
          ([name]) =>
            name.toLowerCase().replace(/[^a-z]/g, '') ===
            skill.replace(/_/g, ''),
        )?.[1];
        expect(actual?.value).toBe(expected!.bonus);
        if (expected!.expertise) expect(actual?.expertise).toBe(true);
      }
    },
  );
});
