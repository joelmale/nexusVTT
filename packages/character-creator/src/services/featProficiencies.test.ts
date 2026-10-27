import { describe, expect, it } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import {
  creationDataToDraft,
  draftToCreationData,
} from '../adapters/draftAdapter';
import { createdCharacterToNexus } from '../adapters/nexusCharacter';
import { classGrantErrors } from './classGrantChoices';
import { featEntitlementErrors } from './featEntitlements';
import type { CharacterCreationData } from '../types/dnd';
import {
  featProficiencyErrors,
  featProficiencyGrants,
  recommendedFeatProficiencies,
} from './featProficiencies';

describe('feat proficiency grants', () => {
  it('keeps repeated Skilled Lessons under separate durable choice keys without granting proficiencies twice', () => {
    const data: CharacterCreationData = {
      ...REFERENCE_BUILDS.WL24.creationData,
      level: 2,
      humanOriginFeat: 'alert',
      eldritchInvocations: ['eldritch-mind', 'lessons-of-the-first-ones'],
      featChoices: {
        'invocation:lessons-of-the-first-ones': {
          targets: ['skilled:lesson-1', 'skilled:lesson-2'],
        },
      },
    };
    data.featChoices = recommendedFeatProficiencies(data);
    expect(classGrantErrors(data)).toEqual([]);
    expect(
      featProficiencyGrants(data).map((grant) => ({
        key: grant.choiceKey,
        count: grant.count,
      })),
    ).toEqual([
      { key: 'skilled:lesson-1', count: 3 },
      { key: 'skilled:lesson-2', count: 3 },
    ]);
    expect(featProficiencyErrors(data)).toEqual([]);
    const restored = draftToCreationData(creationDataToDraft(data));
    const character = calculateCharacterStats(restored);
    expect(featEntitlementErrors(data, character)).toEqual([]);
    const saved = JSON.parse(
      JSON.stringify(createdCharacterToNexus(character)),
    );
    expect(saved.featChoices).toEqual(data.featChoices);
    const first = data.featChoices['skilled:lesson-1']
      .proficiencies as string[];
    const second = data.featChoices['skilled:lesson-2']
      .proficiencies as string[];
    expect(new Set([...first, ...second]).size).toBe(6);
    expect(
      featProficiencyErrors({
        ...data,
        featChoices: {
          ...data.featChoices,
          'skilled:lesson-2': { proficiencies: [first[0], ...second.slice(1)] },
        },
      }).length,
    ).toBeGreaterThan(0);
    const removed: CharacterCreationData = {
      ...data,
      featChoices: {
        ...data.featChoices,
        'invocation:lessons-of-the-first-ones': {
          targets: ['skilled:lesson-1'],
        },
      },
    };
    expect(featProficiencyGrants(removed)).toHaveLength(1);
    expect(removed.featChoices?.['skilled:lesson-2']).toBeDefined(); // retained for repair, without applying its removed grant
  });
  it('keeps two repeatable Skilled grants as six distinct proficiencies', () => {
    const data = {
      ...REFERENCE_BUILDS.F24.creationData,
      background: 'charlatan-2024',
      originFeat: 'skilled',
      humanOriginFeat: 'skilled',
    };
    expect(featProficiencyGrants(data)[0].count).toBe(6);
    const choices = recommendedFeatProficiencies(data);
    expect(new Set(choices.skilled.proficiencies as string[]).size).toBe(6);
    expect(featProficiencyErrors({ ...data, featChoices: choices })).toEqual(
      [],
    );
  });
  it('requires three distinct new Skilled proficiencies and applies skills and tools', () => {
    const data = {
      ...REFERENCE_BUILDS.F24.creationData,
      humanOriginFeat: 'skilled',
    };
    expect(featProficiencyErrors(data)).toHaveLength(1);
    const selected = {
      ...data,
      featChoices: {
        skilled: { proficiencies: ['Arcana', 'History', 'Lute'] },
      },
    };
    expect(featProficiencyErrors(selected)).toEqual([]);
    const character = calculateCharacterStats(selected);
    expect(character.skills.Arcana.proficient).toBe(true);
    expect(character.skills.History.proficient).toBe(true);
    expect(character.proficiencies?.tools).toContain('Lute');
    expect(
      featProficiencyErrors({
        ...data,
        featChoices: {
          skilled: { proficiencies: ['Arcana', 'Arcana', 'Athletics'] },
        },
      }),
    ).toHaveLength(1);
  });
  it.each(['crafter', 'musician'])(
    'offers only eligible %s tools and provides deterministic choices',
    (feat) => {
      const data = {
        ...REFERENCE_BUILDS.F24.creationData,
        humanOriginFeat: feat,
      };
      const grant = featProficiencyGrants(data)[0];
      expect(grant.options).not.toContain('Arcana');
      expect(grant.options).toContain(
        feat === 'crafter' ? "Alchemist's Supplies" : 'Lute',
      );
      expect(
        featProficiencyErrors({
          ...data,
          featChoices: recommendedFeatProficiencies(data),
        }),
      ).toEqual([]);
    },
  );
});
