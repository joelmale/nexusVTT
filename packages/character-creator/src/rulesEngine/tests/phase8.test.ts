/**
 * Phase 8 Tests: Spellcasting
 * Tests for spellcasting ability, spell slots, and caster features
 */

import { describe, it, expect } from 'vitest';
import { evaluateCharacter } from '../executors/characterExecutor';
import type { BaseFacts } from '../types/baseFacts';
import { wizardEffects } from '../content/classes/wizard';
import { clericEffects } from '../content/classes/cleric';

describe('Phase 8: Spellcasting', () => {
  describe('Spellcasting Ability', () => {
    it('should set wizard spellcasting ability to INT', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'wizard',
        classLevel: { wizard: 1 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 14,
          CON: 12,
          INT: 18, // +4 modifier
          WIS: 12,
          CHA: 10,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = wizardEffects;
      const derived = evaluateCharacter(facts, effects);

      // Spellcasting should be initialized
      expect(derived.spellcasting).toBeDefined();
      expect(derived.spellcasting?.ability).toBe('INT');
    });

    it('should set cleric spellcasting ability to WIS', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'cleric',
        classLevel: { cleric: 1 },
        subclassSlug: '',
        speciesSlug: 'dwarf',
        lineageSlug: '',
        backgroundSlug: 'acolyte',
        edition: '2014',
        abilities: {
          STR: 14,
          DEX: 10,
          CON: 14,
          INT: 10,
          WIS: 16, // +3 modifier
          CHA: 12,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = clericEffects;
      const derived = evaluateCharacter(facts, effects);

      // Spellcasting should be initialized
      expect(derived.spellcasting).toBeDefined();
      expect(derived.spellcasting?.ability).toBe('WIS');
    });
  });

  describe('Spell Save DC and Attack Bonus', () => {
    it('should calculate wizard spell save DC correctly', () => {
      const facts: BaseFacts = {
        level: 5,
        classSlug: 'wizard',
        classLevel: { wizard: 5 },
        subclassSlug: '',
        speciesSlug: 'gnome',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2014',
        abilities: {
          STR: 8,
          DEX: 14,
          CON: 12,
          INT: 18, // +4 modifier
          WIS: 12,
          CHA: 10,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = wizardEffects;
      const derived = evaluateCharacter(facts, effects);

      // Proficiency bonus at level 5 = +3
      // Spell Save DC = 8 + prof (+3) + INT mod (+4) = 15
      expect(derived.spellcasting?.saveDC).toBe(15);

      // Spell Attack Bonus = prof (+3) + INT mod (+4) = +7
      expect(derived.spellcasting?.attackBonus).toBe(7);
    });

    it('should calculate cleric spell save DC correctly', () => {
      const facts: BaseFacts = {
        level: 3,
        classSlug: 'cleric',
        classLevel: { cleric: 3 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'acolyte',
        edition: '2014',
        abilities: {
          STR: 14,
          DEX: 10,
          CON: 14,
          INT: 10,
          WIS: 17, // +3 modifier
          CHA: 12,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = clericEffects;
      const derived = evaluateCharacter(facts, effects);

      // Proficiency bonus at level 3 = +2
      // Spell Save DC = 8 + prof (+2) + WIS mod (+3) = 13
      expect(derived.spellcasting?.saveDC).toBe(13);

      // Spell Attack Bonus = prof (+2) + WIS mod (+3) = +5
      expect(derived.spellcasting?.attackBonus).toBe(5);
    });
  });

  describe('Spell Slots', () => {
    it('should grant correct spell slots at level 1', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'wizard',
        classLevel: { wizard: 1 },
        subclassSlug: '',
        speciesSlug: 'elf',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 14,
          CON: 12,
          INT: 16,
          WIS: 12,
          CHA: 10,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = wizardEffects;
      const derived = evaluateCharacter(facts, effects);

      // Level 1 wizard: 2x 1st level slots
      expect(derived.spellcasting?.slots[1]?.max).toBe(2);
      expect(derived.spellcasting?.slots[1]?.used).toBe(0);
    });

    it('should grant correct spell slots at level 3', () => {
      const facts: BaseFacts = {
        level: 3,
        classSlug: 'cleric',
        classLevel: { cleric: 3 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'acolyte',
        edition: '2014',
        abilities: {
          STR: 14,
          DEX: 10,
          CON: 14,
          INT: 10,
          WIS: 16,
          CHA: 12,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = clericEffects;
      const derived = evaluateCharacter(facts, effects);

      // Level 3 cleric: 4x 1st, 2x 2nd level slots
      expect(derived.spellcasting?.slots[1]?.max).toBe(4);
      expect(derived.spellcasting?.slots[2]?.max).toBe(2);
    });

    it('should grant correct spell slots at level 5', () => {
      const facts: BaseFacts = {
        level: 5,
        classSlug: 'wizard',
        classLevel: { wizard: 5 },
        subclassSlug: '',
        speciesSlug: 'gnome',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2014',
        abilities: {
          STR: 8,
          DEX: 14,
          CON: 12,
          INT: 18,
          WIS: 12,
          CHA: 10,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = wizardEffects;
      const derived = evaluateCharacter(facts, effects);

      // Level 5 wizard: 4x 1st, 3x 2nd, 2x 3rd level slots
      expect(derived.spellcasting?.slots[1]?.max).toBe(4);
      expect(derived.spellcasting?.slots[2]?.max).toBe(3);
      expect(derived.spellcasting?.slots[3]?.max).toBe(2);
    });

    it('should grant correct spell slots at level 9', () => {
      const facts: BaseFacts = {
        level: 9,
        classSlug: 'cleric',
        classLevel: { cleric: 9 },
        subclassSlug: '',
        speciesSlug: 'dwarf',
        lineageSlug: '',
        backgroundSlug: 'acolyte',
        edition: '2014',
        abilities: {
          STR: 14,
          DEX: 10,
          CON: 16,
          INT: 10,
          WIS: 18,
          CHA: 12,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = clericEffects;
      const derived = evaluateCharacter(facts, effects);

      // Level 9 cleric: 4x 1st, 3x 2nd, 3x 3rd, 3x 4th, 1x 5th
      expect(derived.spellcasting?.slots[1]?.max).toBe(4);
      expect(derived.spellcasting?.slots[2]?.max).toBe(3);
      expect(derived.spellcasting?.slots[3]?.max).toBe(3);
      expect(derived.spellcasting?.slots[4]?.max).toBe(3);
      expect(derived.spellcasting?.slots[5]?.max).toBe(1);
    });
  });

  describe('Caster Features', () => {
    it('should grant wizard spellbook feature', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'wizard',
        classLevel: { wizard: 1 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 14,
          CON: 12,
          INT: 16,
          WIS: 12,
          CHA: 10,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = wizardEffects;
      const derived = evaluateCharacter(facts, effects);

      // Should have spellbook feature
      const spellbookFeature = derived.features.find((f) => f.id === 'spellbook');
      expect(spellbookFeature).toBeDefined();
      expect(spellbookFeature?.name).toBe('Spellbook');

      // Should have spellbook tag
      expect(derived.tags).toContain('spellbook');
    });

    it('should grant cleric prepared caster feature', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'cleric',
        classLevel: { cleric: 1 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'acolyte',
        edition: '2014',
        abilities: {
          STR: 14,
          DEX: 10,
          CON: 14,
          INT: 10,
          WIS: 16,
          CHA: 12,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = clericEffects;
      const derived = evaluateCharacter(facts, effects);

      // Should have prepared caster feature
      const spellcastingFeature = derived.features.find((f) => f.id === 'cleric-spellcasting');
      expect(spellcastingFeature).toBeDefined();
      expect(spellcastingFeature?.name).toBe('Spellcasting');

      // Should have prepared-caster tag
      expect(derived.tags).toContain('prepared-caster');
    });
  });

  describe('Proficiency Integration', () => {
    it('should affect spell save DC when INT increases', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'wizard',
        classLevel: { wizard: 1 },
        subclassSlug: '',
        speciesSlug: 'gnome',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 14,
          CON: 12,
          INT: 20, // +5 modifier (higher than normal)
          WIS: 12,
          CHA: 10,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = wizardEffects;
      const derived = evaluateCharacter(facts, effects);

      // Proficiency bonus at level 1 = +2
      // Spell Save DC = 8 + prof (+2) + INT mod (+5) = 15
      expect(derived.spellcasting?.saveDC).toBe(15);

      // Spell Attack Bonus = prof (+2) + INT mod (+5) = +7
      expect(derived.spellcasting?.attackBonus).toBe(7);
    });

    it('should increase spell save DC with higher character level', () => {
      const facts: BaseFacts = {
        level: 9,
        classSlug: 'cleric',
        classLevel: { cleric: 9 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'acolyte',
        edition: '2014',
        abilities: {
          STR: 14,
          DEX: 10,
          CON: 14,
          INT: 10,
          WIS: 18, // +4 modifier
          CHA: 12,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = clericEffects;
      const derived = evaluateCharacter(facts, effects);

      // Proficiency bonus at level 9 = +4
      // Spell Save DC = 8 + prof (+4) + WIS mod (+4) = 16
      expect(derived.spellcasting?.saveDC).toBe(16);

      // Spell Attack Bonus = prof (+4) + WIS mod (+4) = +8
      expect(derived.spellcasting?.attackBonus).toBe(8);
    });
  });
});
