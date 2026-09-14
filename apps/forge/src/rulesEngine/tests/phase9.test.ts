/**
 * Phase 9 Tests: Conditions, Buffs, and Temporary Effects
 * Tests for status conditions, spell buffs, advantage/disadvantage, and initiative
 */

import { describe, it, expect } from 'vitest';
import { evaluateCharacter } from '../executors/characterExecutor';
import type { BaseFacts } from '../types/baseFacts';
import {
  grappledCondition,
  paralyzedCondition,
  unconsciousCondition,
  poisonedCondition,
} from '../content/conditions/statusConditions';
import {
  blessSpell,
  shieldOfFaithSpell,
  hasteSpell,
  mageArmorSpell,
  aidSpell,
} from '../content/spells/buffs';

describe('Phase 9: Conditions, Buffs, and Temporary Effects', () => {
  describe('Status Conditions', () => {
    it('should apply grappled condition and set speed to 0', () => {
      const facts: BaseFacts = {
        level: 5,
        classSlug: 'fighter',
        classLevel: { fighter: 5 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'soldier',
        edition: '2014',
        abilities: {
          STR: 16,
          DEX: 14,
          CON: 14,
          INT: 10,
          WIS: 12,
          CHA: 10,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: ['grappled'],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = [grappledCondition];
      const derived = evaluateCharacter(facts, effects);

      // Should have grappled condition tag
      expect(derived.tags).toContain('condition:grappled');

      // Speed should be set to 0
      expect(derived.speed.walk).toBe(0);
    });

    it('should apply paralyzed condition with all effects', () => {
      const facts: BaseFacts = {
        level: 3,
        classSlug: 'rogue',
        classLevel: { rogue: 3 },
        subclassSlug: '',
        speciesSlug: 'halfling',
        lineageSlug: '',
        backgroundSlug: 'criminal',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 18,
          CON: 12,
          INT: 12,
          WIS: 12,
          CHA: 10,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: ['paralyzed'],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = [paralyzedCondition];
      const derived = evaluateCharacter(facts, effects);

      // Should have paralyzed and incapacitated tags
      expect(derived.tags).toContain('condition:paralyzed');
      expect(derived.tags).toContain('condition:incapacitated');

      // Speed should be 0
      expect(derived.speed.walk).toBe(0);

      // Should have auto-fail tag for STR/DEX saves
      expect(derived.tags).toContain('auto-fail-str-dex-saves');
    });

    it('should apply unconscious condition with comprehensive effects', () => {
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
          STR: 8,
          DEX: 14,
          CON: 10,
          INT: 18,
          WIS: 12,
          CHA: 10,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: ['unconscious'],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = [unconsciousCondition];
      const derived = evaluateCharacter(facts, effects);

      // Should have multiple condition tags
      expect(derived.tags).toContain('condition:unconscious');
      expect(derived.tags).toContain('condition:incapacitated');
      expect(derived.tags).toContain('condition:prone');
      expect(derived.tags).toContain('cannot-move');
      expect(derived.tags).toContain('unaware');

      // Speed should be 0
      expect(derived.speed.walk).toBe(0);
    });

    it('should apply poisoned condition', () => {
      const facts: BaseFacts = {
        level: 2,
        classSlug: 'cleric',
        classLevel: { cleric: 2 },
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
          WIS: 16,
          CHA: 12,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: ['poisoned'],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = [poisonedCondition];
      const derived = evaluateCharacter(facts, effects);

      // Should have poisoned condition tag
      expect(derived.tags).toContain('condition:poisoned');
    });
  });

  describe('Spell Buffs - AC Bonuses', () => {
    it('should apply Shield of Faith +2 AC bonus', () => {
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
          DEX: 12, // +1 modifier
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

      const effects = [shieldOfFaithSpell];
      const derived = evaluateCharacter(facts, effects);

      // Base AC = 10 + DEX (1) = 11
      // Shield of Faith: +2 = 13
      expect(derived.ac.value).toBe(13);

      // Should have spell tag
      expect(derived.tags).toContain('spell:shield-of-faith');
      expect(derived.tags).toContain('concentration');
    });

    it('should apply Mage Armor base AC', () => {
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
          STR: 8,
          DEX: 16, // +3 modifier
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

      const effects = [mageArmorSpell];
      const derived = evaluateCharacter(facts, effects);

      // Mage Armor: 13 + DEX (3) = 16
      expect(derived.ac.value).toBe(16);

      // Should have spell tag
      expect(derived.tags).toContain('spell:mage-armor');
    });

    it('should apply Haste comprehensive buffs', () => {
      const facts: BaseFacts = {
        level: 5,
        classSlug: 'fighter',
        classLevel: { fighter: 5 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'soldier',
        edition: '2014',
        abilities: {
          STR: 16,
          DEX: 14, // +2 modifier
          CON: 14,
          INT: 10,
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

      const effects = [hasteSpell];
      const derived = evaluateCharacter(facts, effects);

      // Base AC = 10 + DEX (2) = 12
      // Haste: +2 AC = 14
      expect(derived.ac.value).toBe(14);

      // Should have DEX save advantage
      expect(derived.saves.DEX.advantage.length).toBeGreaterThan(0);

      // Should have spell tags
      expect(derived.tags).toContain('spell:haste');
      expect(derived.tags).toContain('concentration');
      expect(derived.tags).toContain('extra-action');
    });
  });

  describe('Spell Buffs - Saving Throw Bonuses', () => {
    it('should apply Bless to all saving throws', () => {
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
          STR: 14, // +2
          DEX: 10, // +0
          CON: 14, // +2
          INT: 10, // +0
          WIS: 16, // +3
          CHA: 12, // +1
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

      const effects = [blessSpell];
      const derived = evaluateCharacter(facts, effects);

      // Bless adds +2 (average of 1d4) to all saves
      // STR save: +2 (ability mod) + 0 (no prof) + 2 (bless) = 4
      expect(derived.saves.STR.bonus).toBe(4);

      // DEX save: +0 (ability mod) + 0 (no prof) + 2 (bless) = 2
      expect(derived.saves.DEX.bonus).toBe(2);

      // Should have spell tag
      expect(derived.tags).toContain('spell:bless');
    });
  });

  describe('Spell Buffs - HP and Speed', () => {
    it('should apply Aid HP bonus', () => {
      const facts: BaseFacts = {
        level: 3,
        classSlug: 'cleric',
        classLevel: { cleric: 3 },
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

      const effects = [aidSpell];
      const derived = evaluateCharacter(facts, effects);

      // Should have spell tag
      expect(derived.tags).toContain('spell:aid');
    });
  });

  describe('Advantage and Disadvantage', () => {
    it('should grant advantage on DEX saves from Haste', () => {
      const facts: BaseFacts = {
        level: 5,
        classSlug: 'rogue',
        classLevel: { rogue: 5 },
        subclassSlug: '',
        speciesSlug: 'halfling',
        lineageSlug: '',
        backgroundSlug: 'criminal',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 18, // +4
          CON: 12,
          INT: 12,
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

      const effects = [hasteSpell];
      const derived = evaluateCharacter(facts, effects);

      // Should have advantage on DEX saves
      expect(derived.saves.DEX.advantage).toContain('spell:haste');
      expect(derived.saves.DEX.advantage.length).toBe(1);

      // Other saves should NOT have advantage
      expect(derived.saves.STR.advantage.length).toBe(0);
      expect(derived.saves.CON.advantage.length).toBe(0);
    });
  });

  describe('Initiative Bonuses', () => {
    it('should calculate initiative bonus correctly', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'rogue',
        classLevel: { rogue: 1 },
        subclassSlug: '',
        speciesSlug: 'elf',
        lineageSlug: '',
        backgroundSlug: 'criminal',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 18, // +4 modifier
          CON: 12,
          INT: 12,
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

      const effects: any[] = [];
      const derived = evaluateCharacter(facts, effects);

      // Initiative = DEX modifier (+4)
      expect(derived.initiative.bonus).toBe(4);
    });

    it('should add initiative bonus from feat/feature', () => {
      const facts: BaseFacts = {
        level: 4,
        classSlug: 'fighter',
        classLevel: { fighter: 4 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'soldier',
        edition: '2014',
        abilities: {
          STR: 16,
          DEX: 14, // +2 modifier
          CON: 14,
          INT: 10,
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

      // Alert feat: +5 initiative
      const alertFeat: any = {
        sourceId: 'feat:alert',
        effectId: 'alert-initiative',
        name: 'Alert',
        description: 'You gain a +5 bonus to initiative.',
        effects: [
          {
            kind: 'initiativeBonus',
            value: 5,
            stacking: 'stack',
          },
        ],
      };

      const effects = [alertFeat];
      const derived = evaluateCharacter(facts, effects);

      // Initiative = DEX modifier (+2) + Alert (+5) = +7
      expect(derived.initiative.bonus).toBe(7);
    });
  });

  describe('Condition and Buff Interaction', () => {
    it('should apply both condition and buff effects', () => {
      const facts: BaseFacts = {
        level: 5,
        classSlug: 'paladin',
        classLevel: { paladin: 5 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'noble',
        edition: '2014',
        abilities: {
          STR: 16,
          DEX: 10,
          CON: 14,
          INT: 10,
          WIS: 12,
          CHA: 16,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: ['grappled'],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = [grappledCondition, blessSpell, shieldOfFaithSpell];
      const derived = evaluateCharacter(facts, effects);

      // Should have grappled condition (speed = 0)
      expect(derived.tags).toContain('condition:grappled');
      expect(derived.speed.walk).toBe(0);

      // Should still have Bless bonus on saves
      // STR save: +3 (ability mod) + 0 (no prof) + 2 (bless) = 5
      expect(derived.saves.STR.bonus).toBe(5);

      // Should have Shield of Faith AC bonus
      // Base AC = 10 + DEX (0) = 10
      // Shield of Faith: +2 = 12
      expect(derived.ac.value).toBe(12);

      // Should have both spell tags
      expect(derived.tags).toContain('spell:bless');
      expect(derived.tags).toContain('spell:shield-of-faith');
    });
  });
});
