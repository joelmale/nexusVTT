import { describe, it, expect } from 'vitest';
import {
  calculatePreparationLimit,
  evaluatePreparationPlan,
} from '../src';
import type { SpellcastingProfile } from '@nexus/game-contracts';

describe('D&D 5e Spell Preparation Engine', () => {
  it('calculates preparation limits for various classes and editions', () => {
    // Wizard level 5, INT +4 = 9
    expect(calculatePreparationLimit('wizard', 5, 4)).toBe(9);
    // Cleric level 3, WIS +2 = 5
    expect(calculatePreparationLimit('cleric', 3, 2)).toBe(5);
    // Druid level 4, WIS +3 = 7
    expect(calculatePreparationLimit('druid', 4, 3)).toBe(7);
    // Paladin 2014 level 6, CHA +2 = floor(6 / 2) + 2 = 5
    expect(calculatePreparationLimit('paladin', 6, 2, '2014')).toBe(5);
    // Paladin 2024 level 5, CHA +2 = ceil(5 / 2) + 2 = 5
    expect(calculatePreparationLimit('paladin', 5, 2, '2024')).toBe(5);
    // Ranger 2014 = 0 (known spells)
    expect(calculatePreparationLimit('ranger', 5, 2, '2014')).toBe(0);
    // Ranger 2024 = ceil(5 / 2) + 2 = 5
    expect(calculatePreparationLimit('ranger', 5, 2, '2024')).toBe(5);
    // Custom/other class fallback
    expect(calculatePreparationLimit('custom-class', 4, 1)).toBe(5);
    // Minimum 1 even with negative modifier
    expect(calculatePreparationLimit('wizard', 1, -4)).toBe(1);
  });

  const mockWizardProfile: SpellcastingProfile = {
    profileId: 'wiz-1',
    name: 'Wizard Spellcasting',
    sourceType: 'class',
    sourceSlug: 'wizard',
    spellcastingAbility: 'INT',
    spellSaveDC: 15,
    spellAttackBonus: 7,
    isRitualCaster: true,
    preparationMode: 'prepared',
    preparationLimit: 3,
    resourcePoolId: 'standard-slots',
    boundCollectionIds: [],
    knownSpellSlugs: ['fireball', 'mage-armor', 'magic-missile', 'shield'],
    preparedSpellSlugs: ['fireball'],
  };

  it('validates a legal preparation plan', () => {
    const plan = ['fireball', 'mage-armor', 'shield'];
    const accessibleGrimoire = ['fireball', 'mage-armor', 'magic-missile', 'shield'];

    const result = evaluatePreparationPlan(mockWizardProfile, plan, accessibleGrimoire);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.preparedCount).toBe(3);
  });

  it('rejects a plan that exceeds capacity', () => {
    const plan = ['fireball', 'mage-armor', 'magic-missile', 'shield']; // 4 spells, limit 3
    const result = evaluatePreparationPlan(mockWizardProfile, plan);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('exceeds preparation capacity');
  });

  it('rejects a spell not present in accessible spellbooks', () => {
    const plan = ['fireball', 'wish'];
    const accessibleGrimoire = ['fireball', 'mage-armor'];

    const result = evaluatePreparationPlan(mockWizardProfile, plan, accessibleGrimoire);
    expect(result.isValid).toBe(false);
    expect(result.invalidSpells).toContain('wish');
  });

  it('rejects daily preparation plans on known casters', () => {
    const sorcererProfile: SpellcastingProfile = {
      ...mockWizardProfile,
      sourceSlug: 'sorcerer',
      preparationMode: 'known',
    };

    const result = evaluatePreparationPlan(sorcererProfile, ['fireball']);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('fixed repertoire of known spells');
  });
});
