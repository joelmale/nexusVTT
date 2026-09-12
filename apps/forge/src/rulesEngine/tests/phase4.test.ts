/**
 * Phase 4 Tests: Spellcasting System
 * Tests for spellcasting ability, spell slots, save DC, and attack bonus
 */

import { describe, it, expect } from 'vitest';
import { evaluateCharacter } from '../executors/characterExecutor';
import { wizardEffects } from '../content/classes/wizard';
import { clericEffects } from '../content/classes/cleric';
import type { BaseFacts } from '../types/baseFacts';
import type { SourcedEffect } from '../types/effects';

describe('Phase 4: Spellcasting System', () => {
  describe('Spellcasting Ability', () => {
    it('should set spellcasting ability and initialize spellcasting object', () => {
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
          INT: 16, // +3 modifier
          WIS: 10,
          CHA: 8,
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

      const effects: SourcedEffect[] = wizardEffects;
      const derived = evaluateCharacter(facts, effects);

      expect(derived.spellcasting).toBeDefined();
      expect(derived.spellcasting?.ability).toBe('INT');
    });
  });

  describe('Spell Save DC', () => {
    it('should calculate spell save DC correctly (8 + prof + ability mod)', () => {
      const facts: BaseFacts = {
        level: 5, // Proficiency bonus: +3
        classSlug: 'wizard',
        classLevel: { wizard: 5 },
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
          WIS: 10,
          CHA: 8,
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

      const effects: SourcedEffect[] = wizardEffects;
      const derived = evaluateCharacter(facts, effects);

      // Spell Save DC = 8 + proficiency (3) + INT modifier (4) = 15
      expect(derived.spellcasting?.saveDC).toBe(15);
    });

    it('should calculate spell save DC with different spellcasting abilities', () => {
      const facts: BaseFacts = {
        level: 3, // Proficiency bonus: +2
        classSlug: 'cleric',
        classLevel: { cleric: 3 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'acolyte',
        edition: '2014',
        abilities: {
          STR: 10,
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

      const effects: SourcedEffect[] = clericEffects;
      const derived = evaluateCharacter(facts, effects);

      // Spell Save DC = 8 + proficiency (2) + WIS modifier (3) = 13
      expect(derived.spellcasting?.saveDC).toBe(13);
    });
  });

  describe('Spell Attack Bonus', () => {
    it('should calculate spell attack bonus correctly (prof + ability mod)', () => {
      const facts: BaseFacts = {
        level: 9, // Proficiency bonus: +4
        classSlug: 'wizard',
        classLevel: { wizard: 9 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 14,
          CON: 12,
          INT: 20, // +5 modifier
          WIS: 10,
          CHA: 8,
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

      const effects: SourcedEffect[] = wizardEffects;
      const derived = evaluateCharacter(facts, effects);

      // Spell Attack Bonus = proficiency (4) + INT modifier (5) = +9
      expect(derived.spellcasting?.attackBonus).toBe(9);
    });
  });

  describe('Spell Slot Progression', () => {
    it('should grant correct spell slots at level 1', () => {
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
          WIS: 10,
          CHA: 8,
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

      const effects: SourcedEffect[] = wizardEffects;
      const derived = evaluateCharacter(facts, effects);

      // Level 1 wizard: 2 first-level slots
      expect(derived.spellcasting?.slots[1]).toEqual({ max: 2, used: 0 });
      expect(derived.spellcasting?.slots[2]).toBeUndefined();
    });

    it('should grant correct spell slots at level 3', () => {
      const facts: BaseFacts = {
        level: 3,
        classSlug: 'wizard',
        classLevel: { wizard: 3 },
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
          WIS: 10,
          CHA: 8,
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

      const effects: SourcedEffect[] = wizardEffects;
      const derived = evaluateCharacter(facts, effects);

      // Level 3 wizard: 4 first-level, 2 second-level slots
      expect(derived.spellcasting?.slots[1]).toEqual({ max: 4, used: 0 });
      expect(derived.spellcasting?.slots[2]).toEqual({ max: 2, used: 0 });
      expect(derived.spellcasting?.slots[3]).toBeUndefined();
    });

    it('should grant correct spell slots at level 9', () => {
      const facts: BaseFacts = {
        level: 9,
        classSlug: 'wizard',
        classLevel: { wizard: 9 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 14,
          CON: 12,
          INT: 18,
          WIS: 10,
          CHA: 8,
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

      const effects: SourcedEffect[] = wizardEffects;
      const derived = evaluateCharacter(facts, effects);

      // Level 9 wizard: 4/3/3/3/1 spell slots
      expect(derived.spellcasting?.slots[1]).toEqual({ max: 4, used: 0 });
      expect(derived.spellcasting?.slots[2]).toEqual({ max: 3, used: 0 });
      expect(derived.spellcasting?.slots[3]).toEqual({ max: 3, used: 0 });
      expect(derived.spellcasting?.slots[4]).toEqual({ max: 3, used: 0 });
      expect(derived.spellcasting?.slots[5]).toEqual({ max: 1, used: 0 });
      expect(derived.spellcasting?.slots[6]).toBeUndefined();
    });

    it('should grant correct spell slots at level 20', () => {
      const facts: BaseFacts = {
        level: 20,
        classSlug: 'wizard',
        classLevel: { wizard: 20 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 14,
          CON: 12,
          INT: 20,
          WIS: 10,
          CHA: 8,
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

      const effects: SourcedEffect[] = wizardEffects;
      const derived = evaluateCharacter(facts, effects);

      // Level 20 wizard: 4/3/3/3/3/2/2/1/1 spell slots
      expect(derived.spellcasting?.slots[1]).toEqual({ max: 4, used: 0 });
      expect(derived.spellcasting?.slots[2]).toEqual({ max: 3, used: 0 });
      expect(derived.spellcasting?.slots[3]).toEqual({ max: 3, used: 0 });
      expect(derived.spellcasting?.slots[4]).toEqual({ max: 3, used: 0 });
      expect(derived.spellcasting?.slots[5]).toEqual({ max: 3, used: 0 });
      expect(derived.spellcasting?.slots[6]).toEqual({ max: 2, used: 0 });
      expect(derived.spellcasting?.slots[7]).toEqual({ max: 2, used: 0 });
      expect(derived.spellcasting?.slots[8]).toEqual({ max: 1, used: 0 });
      expect(derived.spellcasting?.slots[9]).toEqual({ max: 1, used: 0 });
    });
  });

  describe('Grant Spell', () => {
    it('should add cantrips to cantrip list', () => {
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
          WIS: 10,
          CHA: 8,
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

      const effects: SourcedEffect[] = [
        ...wizardEffects,
        {
          sourceId: 'class:wizard',
          effectId: 'cantrip-fire-bolt',
          name: 'Cantrip: Fire Bolt',
          description: 'You learn the Fire Bolt cantrip',
          effects: [
            {
              kind: 'grantSpell',
              spellSlug: 'fire-bolt',
              spellType: 'cantrip',
            },
          ],
        },
        {
          sourceId: 'class:wizard',
          effectId: 'cantrip-mage-hand',
          name: 'Cantrip: Mage Hand',
          description: 'You learn the Mage Hand cantrip',
          effects: [
            {
              kind: 'grantSpell',
              spellSlug: 'mage-hand',
              spellType: 'cantrip',
            },
          ],
        },
      ];

      const derived = evaluateCharacter(facts, effects);

      expect(derived.spellcasting?.cantrips).toContain('fire-bolt');
      expect(derived.spellcasting?.cantrips).toContain('mage-hand');
      expect(derived.spellcasting?.cantrips).toHaveLength(2);
    });

    it('should add spells to known spells list', () => {
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
          WIS: 10,
          CHA: 8,
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

      const effects: SourcedEffect[] = [
        ...wizardEffects,
        {
          sourceId: 'class:wizard',
          effectId: 'spell-magic-missile',
          name: 'Spell: Magic Missile',
          description: 'You learn Magic Missile',
          effects: [
            {
              kind: 'grantSpell',
              spellSlug: 'magic-missile',
              spellType: 'known',
            },
          ],
        },
      ];

      const derived = evaluateCharacter(facts, effects);

      expect(derived.spellcasting?.spellsKnown).toContain('magic-missile');
    });
  });
});
