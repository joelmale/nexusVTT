import { describe, expect, it } from 'vitest';
import { evaluateDraft, toCharacterCreationResult } from './draftEvaluator';
import { creationDataToDraft } from '../adapters/draftAdapter';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';

describe('draftEvaluator (CC-204, CC-205, CC-206)', () => {
  it('evaluates F14 draft correctly and matches reference oracle', () => {
    const f14 = REFERENCE_BUILDS.F14;
    const draft = creationDataToDraft(f14.creationData);
    const result = evaluateDraft(draft);

    expect(result.isValid).toBe(true);
    expect(result.calculatedCharacter.abilities.STR.score).toBe(f14.expected.abilities.STR);
    expect(result.calculatedCharacter.hitPoints).toBe(f14.expected.hp);
    expect(result.calculatedCharacter.armorClass).toBe(f14.expected.ac);
    expect(result.calculatedCharacter.speed).toBe(f14.expected.speed);
  });

  it('evaluates F24 draft correctly and matches reference oracle', () => {
    const f24 = REFERENCE_BUILDS.F24;
    const draft = creationDataToDraft(f24.creationData);
    const result = evaluateDraft(draft);

    expect(result.isValid).toBe(true);
    expect(result.calculatedCharacter.abilities.STR.score).toBe(f24.expected.abilities.STR);
    expect(result.calculatedCharacter.hitPoints).toBe(f24.expected.hp);
    expect(result.calculatedCharacter.armorClass).toBe(f24.expected.ac);
    expect(result.calculatedCharacter.currency?.gp).toBe(f24.expected.currency?.gp);
  });

  it('evaluates R14 and R24 drafts correctly', () => {
    const r14 = REFERENCE_BUILDS.R14;
    const r14Result = evaluateDraft(creationDataToDraft(r14.creationData));
    expect(r14Result.isValid).toBe(true);
    expect(r14Result.calculatedCharacter.abilities.DEX.score).toBe(r14.expected.abilities.DEX);
    expect(r14Result.calculatedCharacter.speed).toBe(r14.expected.speed);

    const r24 = REFERENCE_BUILDS.R24;
    const r24Result = evaluateDraft(creationDataToDraft(r24.creationData));
    expect(r24Result.isValid).toBe(true);
    expect(r24Result.calculatedCharacter.initiative).toBe(r24.expected.initiative);
  });

  it('evaluates W14 and W24 drafts and validates wizard spellcasting', () => {
    const w14 = REFERENCE_BUILDS.W14;
    const w14Result = evaluateDraft(creationDataToDraft(w14.creationData));
    expect(w14Result.isValid).toBe(true);
    expect(w14Result.calculatedCharacter.abilities.INT.score).toBe(w14.expected.abilities.INT);

    const w24 = REFERENCE_BUILDS.W24;
    const w24Result = evaluateDraft(creationDataToDraft(w24.creationData));
    expect(w24Result.isValid).toBe(true);
    expect(w24Result.calculatedCharacter.abilities.INT.score).toBe(w24.expected.abilities.INT);
  });

  it('detects over-prepared spells on a wizard', () => {
    const w14 = REFERENCE_BUILDS.W14;
    const overPreparedDraft = creationDataToDraft({
      ...w14.creationData,
      spellSelection: {
        ...w14.creationData.spellSelection,
        preparedSpells: ['magic-missile', 'mage-armor', 'shield', 'sleep', 'detect-magic', 'feather-fall', 'jump'],
      },
    });

    const result = evaluateDraft(overPreparedDraft);
    expect(result.isValid).toBe(false);
    expect(result.issues.some(i => i.id === 'EXCEEDED_PREPARED_SPELLS_LIMIT')).toBe(true);
  });

  it('produces valid host CharacterCreationResult for Forge and VTT', () => {
    const f24 = REFERENCE_BUILDS.F24;
    const draft = creationDataToDraft(f24.creationData);
    const evaluation = evaluateDraft(draft);
    const hostResult = toCharacterCreationResult(evaluation);

    expect(hostResult.character.name).toBe(f24.creationData.name);
    expect(hostResult.edition).toBe('2024');
    expect(hostResult.creationData).toBeDefined();
    expect(hostResult.createdAt).toBeDefined();
  });
});
