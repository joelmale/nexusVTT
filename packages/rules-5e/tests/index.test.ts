import { describe, it, expect } from 'vitest';
import * as Rules5e from '../src';

describe('@nexus/rules-5e Root Exports', () => {
  it('exports all calculation, progression, preparation, casting, and catalog symbols', () => {
    expect(Rules5e.getAbilityModifier).toBeDefined();
    expect(Rules5e.getProficiencyBonus).toBeDefined();
    expect(Rules5e.calculateSpellSaveDC).toBeDefined();
    expect(Rules5e.FULL_CASTER_SLOTS).toBeDefined();
    expect(Rules5e.calculateMulticlassCasterLevel).toBeDefined();
    expect(Rules5e.getPactMagicSlots).toBeDefined();
    expect(Rules5e.calculatePreparationLimit).toBeDefined();
    expect(Rules5e.evaluatePreparationPlan).toBeDefined();
    expect(Rules5e.evaluateCastEligibility).toBeDefined();
    expect(Rules5e.normalizeSlug).toBeDefined();
    expect(Rules5e.createCatalogKey).toBeDefined();
    expect(Rules5e.parseCatalogKey).toBeDefined();
  });
});
