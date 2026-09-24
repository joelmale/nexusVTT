import { describe, it, expect } from 'vitest';
import {
  spellDefinitionSchema,
  spellCollectionSchema,
  spellcastingProfileSchema,
  castRecordSchema,
} from '../src';
import { mockWizardSpell, mockSpellCollection } from './fixtures';

describe('Spell & Spellbook Schemas', () => {
  it('validates a complete spell definition', () => {
    const parsed = spellDefinitionSchema.parse(mockWizardSpell);
    expect(parsed.name).toBe('Fireball');
    expect(parsed.level).toBe(3);
    expect(parsed.school).toBe('evocation');
    expect(parsed.components.verbal).toBe(true);
  });

  it('validates a spell collection with ordered entries', () => {
    const parsed = spellCollectionSchema.parse(mockSpellCollection);
    expect(parsed.spells).toHaveLength(1);
    expect(parsed.spells[0].slug).toBe('fireball');
    expect(parsed.spells[0].order).toBe(1);
  });

  it('validates class-aware spellcasting profiles', () => {
    const wizardProfile = {
      profileId: 'wizard-core',
      name: 'Wizard Spellcasting',
      sourceType: 'class' as const,
      sourceSlug: 'wizard',
      spellcastingAbility: 'INT' as const,
      spellSaveDC: 15,
      spellAttackBonus: 7,
      isRitualCaster: true,
      preparationMode: 'prepared' as const,
      preparationLimit: 9,
      resourcePoolId: 'standard-slots',
      boundCollectionIds: [mockSpellCollection.id],
      knownSpellSlugs: ['fireball', 'mage-armor', 'magic-missile'],
      preparedSpellSlugs: ['fireball', 'mage-armor'],
    };

    const parsed = spellcastingProfileSchema.parse(wizardProfile);
    expect(parsed.spellcastingAbility).toBe('INT');
    expect(parsed.preparedSpellSlugs).toContain('fireball');
  });

  it('validates cast records with consumed resources', () => {
    const cast = {
      castId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      campaignActorId: '77777777-7777-4777-8777-777777777777',
      spellRef: {
        kind: 'spell' as const,
        id: mockWizardSpell.id,
        revision: 1,
      },
      spellName: 'Fireball',
      castAtLevel: 3,
      sourceProfileId: 'wizard-core',
      consumedResources: [
        {
          poolId: 'standard-slots',
          amount: 1,
          slotLevel: 3,
        },
      ],
      targets: ['target-1', 'target-2'],
      state: 'resolved' as const,
      timestamp: '2026-09-24T00:00:00Z',
    };

    const parsed = castRecordSchema.parse(cast);
    expect(parsed.consumedResources[0].slotLevel).toBe(3);
    expect(parsed.state).toBe('resolved');
  });
});
