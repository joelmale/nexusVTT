import { describe, expect, it } from 'vitest';
import {
  creationDataToDraft,
  draftToCreationData,
} from '../adapters/draftAdapter';
import { initialCreationData } from '../components/CharacterCreationWizard/constants/wizard.constants';
import { getRecommendation } from '../services/recommendationService';
import {
  evaluateDraft,
  toCharacterCreationResult,
} from '../services/draftEvaluator';
import { calculateCharacterStats } from '../utils/characterCreationUtils';

// Independent SRD 5.2.1 references: character creation p21, backgrounds p83,
// Wizard p78, armor p92, Barbarian p29, Monk p50. No production-derived oracles.
describe('creator repair acceptance', () => {
  it('preserves advanced inputs and wizard preparation through draft round trips', () => {
    const data = {
      ...initialCreationData,
      edition: '2024' as const,
      weaponMastery: ['longsword'],
      divineOrder: 'thaumaturge' as const,
      spellSelection: {
        selectedCantrips: [],
        spellbook: ['shield'],
        dailyPrepared: ['shield'],
      },
    };
    const restored = draftToCreationData(creationDataToDraft(data));
    expect(restored.weaponMastery).toEqual(['longsword']);
    expect(restored.divineOrder).toBe('thaumaturge');
    expect(restored.spellSelection.dailyPrepared).toEqual(['shield']);
  });
  it('supplies class armor and one background grant in the actual Fighter result', () => {
    const rec = getRecommendation({ classSlug: 'fighter', edition: '2024' });
    const saved = calculateCharacterStats(draftToCreationData(rec.draft));
    expect(
      saved.inventory?.some((item) => item.equipmentSlug === 'chain-mail'),
    ).toBe(true);
    expect(
      saved.inventory
        ?.filter((item) => item.equipmentSlug === 'spear')
        .reduce((n, item) => n + item.quantity, 0),
    ).toBe(1);
    expect(saved.currency?.gp).toBe(18);
  });
  it('preserves wizard prepared spells in the saved object', () => {
    const rec = getRecommendation({ classSlug: 'wizard', edition: '2024' });
    expect(
      rec.evaluation.calculatedCharacter!.spellcasting?.preparedSpells,
    ).toEqual(rec.draft.spells.prepared);
  });
  it.each(['bard', 'sorcerer', 'warlock'])(
    'preserves %s leveled spell choices',
    (classSlug) => {
      const rec = getRecommendation({ classSlug, edition: '2014' });
      expect(
        rec.evaluation.calculatedCharacter!.spellcasting?.spellsKnown?.length,
      ).toBeGreaterThan(0);
    },
  );
  it('rejects Acolyte bonuses to Constitution', () => {
    const draft = getRecommendation({
      classSlug: 'cleric',
      edition: '2024',
    }).draft;
    draft.abilityBonuses = { method: '2/1', bonuses: { WIS: 2, CON: 1 } };
    expect(
      evaluateDraft(draft).issues.some(
        (issue) => issue.id === 'INVALID_BACKGROUND_BONUS_TARGET',
      ),
    ).toBe(true);
  });
  it('rejects finalizing an invalid evaluation', () => {
    const result = getRecommendation({
      classSlug: 'fighter',
      edition: '2024',
    }).evaluation;
    expect(() =>
      toCharacterCreationResult({ ...result, isValid: false }),
    ).toThrow();
  });
  it('rejects an evaluation whose draft was mutated without a revision update', () => {
    const result = getRecommendation({
      classSlug: 'fighter',
      edition: '2024',
    }).evaluation;
    result.draft.name = 'Changed after preview';
    expect(() => toCharacterCreationResult(result)).toThrow(
      'changed after evaluation',
    );
  });
  it('rejects Wizard spells outside the class list or spellbook', () => {
    const draft = getRecommendation({
      classSlug: 'wizard',
      edition: '2024',
    }).draft;
    draft.spells.prepared = ['healing-word'];
    const issues = evaluateDraft(draft).issues.map((issue) => issue.id);
    expect(issues).toContain('INVALID_CLASS_SPELL');
    expect(issues).toContain('PREPARED_OUTSIDE_SPELLBOOK');
  });
  it('does not count a carried shield as equipped armor', () => {
    const data = draftToCreationData(
      getRecommendation({ classSlug: 'fighter', edition: '2024' }).draft,
    );
    data.startingInventory = [
      { equipmentSlug: 'shield', quantity: 1, equipped: false },
    ];
    data.abilities.DEX = 8;
    data.equipmentChoices = [];
    expect(calculateCharacterStats(data).armorClass).toBe(9);
  });
});
