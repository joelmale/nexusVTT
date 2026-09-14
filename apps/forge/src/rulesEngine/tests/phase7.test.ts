/**
 * Phase 7 Tests: Equipment & Items
 * Tests for armor, weapons, magic items, and attunement
 */

import { describe, it, expect } from 'vitest';
import { evaluateCharacter } from '../executors/characterExecutor';
import type { BaseFacts } from '../types/baseFacts';
import {
  leatherArmor,
  chainMail,
  plateArmor,
  shield,
  hideArmor,
} from '../content/equipment/armor';
import {
  ringOfProtection,
  cloakOfProtection,
  bracersOfDefense,
  gauntletsOfOgrePower,
} from '../content/equipment/magicItems';
import { fighterProficiencies } from '../content/classes/fighter';

describe('Phase 7: Equipment & Items', () => {
  describe('Armor AC Calculations', () => {
    it('should calculate light armor AC with full DEX bonus', () => {
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
          WIS: 10,
          CHA: 10,
        },
        choices: {},
        equippedArmor: 'leather-armor',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      // Add light armor proficiency
      const lightArmorProf: any = {
        sourceId: 'class:rogue',
        effectId: 'rogue-armor-prof',
        name: 'Light Armor Proficiency',
        description: '',
        effects: [
          {
            kind: 'grantProficiency',
            profType: 'armor',
            values: ['Light armor'],
          },
        ],
      };

      const effects = [lightArmorProf, leatherArmor];
      const derived = evaluateCharacter(facts, effects);

      // Leather armor: 11 + DEX (4) = 15
      expect(derived.ac.value).toBe(15);
    });

    it('should calculate medium armor AC with DEX cap of +2', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'ranger',
        classLevel: { ranger: 1 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'outlander',
        edition: '2014',
        abilities: {
          STR: 14,
          DEX: 16, // +3 modifier, but capped at +2
          CON: 14,
          INT: 10,
          WIS: 14,
          CHA: 10,
        },
        choices: {},
        equippedArmor: 'hide-armor',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      // Add medium armor proficiency
      const mediumArmorProf: any = {
        sourceId: 'class:ranger',
        effectId: 'ranger-armor-prof',
        name: 'Medium Armor Proficiency',
        description: '',
        effects: [
          {
            kind: 'grantProficiency',
            profType: 'armor',
            values: ['Light armor', 'Medium armor'],
          },
        ],
      };

      const effects = [mediumArmorProf, hideArmor];
      const derived = evaluateCharacter(facts, effects);

      // Hide armor: 12 + min(DEX (3), 2) = 12 + 2 = 14
      expect(derived.ac.value).toBe(14);
    });

    it('should calculate heavy armor AC with no DEX bonus', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'fighter',
        classLevel: { fighter: 1 },
        subclassSlug: '',
        speciesSlug: 'dwarf',
        lineageSlug: '',
        backgroundSlug: 'soldier',
        edition: '2014',
        abilities: {
          STR: 16,
          DEX: 14, // +2 modifier, but heavy armor ignores it
          CON: 16,
          INT: 10,
          WIS: 10,
          CHA: 10,
        },
        choices: {},
        equippedArmor: 'chain-mail',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = [...fighterProficiencies, chainMail];
      const derived = evaluateCharacter(facts, effects);

      // Chain mail: 16 (no DEX bonus)
      expect(derived.ac.value).toBe(16);
    });

    it('should require STR for heavy armor', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'fighter',
        classLevel: { fighter: 1 },
        subclassSlug: '',
        speciesSlug: 'halfling',
        lineageSlug: '',
        backgroundSlug: 'soldier',
        edition: '2014',
        abilities: {
          STR: 12, // Below required 15 for plate armor
          DEX: 14,
          CON: 14,
          INT: 10,
          WIS: 10,
          CHA: 10,
        },
        choices: {},
        equippedArmor: 'plate-armor',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = [...fighterProficiencies, plateArmor];
      const derived = evaluateCharacter(facts, effects);

      // Plate armor requires STR 15, character has STR 12
      // Should fall back to unarmored: 10 + DEX (2) = 12
      expect(derived.ac.value).toBe(12);
    });

    it('should stack shield bonus on armor', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'fighter',
        classLevel: { fighter: 1 },
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
          WIS: 10,
          CHA: 10,
        },
        choices: {},
        equippedArmor: 'chain-mail',
        equippedWeapons: [],
        equippedItems: ['shield'],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = [...fighterProficiencies, chainMail, shield];
      const derived = evaluateCharacter(facts, effects);

      // Chain mail (16) + Shield (+2) = 18
      expect(derived.ac.value).toBe(18);
    });
  });

  describe('Magic Item Bonuses', () => {
    it('should apply Ring of Protection when attuned', () => {
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
        tags: ['attuned:ring-of-protection'],
        feats: [],
        resourceUsage: {},
      };

      const effects = [ringOfProtection];
      const derived = evaluateCharacter(facts, effects);

      // Unarmored: 10 + DEX (2) = 12
      // Ring of Protection: +1 AC = 13
      expect(derived.ac.value).toBe(13);

      // Ring of Protection: +1 to all saves
      // STR save: -1 (ability mod) + 0 (no prof) + 1 (ring) = 0
      expect(derived.saves.STR.bonus).toBe(0);
      // INT save: +4 (ability mod) + 0 (no prof) + 1 (ring) = 5
      expect(derived.saves.INT.bonus).toBe(5);
    });

    it('should NOT apply Ring of Protection without attunement', () => {
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
        tags: [], // NOT attuned
        feats: [],
        resourceUsage: {},
      };

      const effects = [ringOfProtection];
      const derived = evaluateCharacter(facts, effects);

      // Unarmored: 10 + DEX (2) = 12 (no Ring bonus)
      expect(derived.ac.value).toBe(12);
    });

    it('should apply Bracers of Defense only when not wearing armor', () => {
      const facts: BaseFacts = {
        level: 3,
        classSlug: 'monk',
        classLevel: { monk: 3 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'hermit',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 16, // +3
          CON: 14,
          INT: 10,
          WIS: 16, // +3
          CHA: 10,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: ['attuned:bracers-of-defense'],
        feats: [],
        resourceUsage: {},
      };

      const effects = [bracersOfDefense];
      const derived = evaluateCharacter(facts, effects);

      // Unarmored: 10 + DEX (3) = 13
      // Bracers: +2 AC = 15
      expect(derived.ac.value).toBe(15);
    });

    it('should NOT apply Bracers of Defense when wearing armor', () => {
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
          DEX: 16,
          CON: 12,
          INT: 12,
          WIS: 10,
          CHA: 10,
        },
        choices: {},
        equippedArmor: 'leather-armor',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: ['attuned:bracers-of-defense'],
        feats: [],
        resourceUsage: {},
      };

      // Add light armor proficiency
      const lightArmorProf: any = {
        sourceId: 'class:rogue',
        effectId: 'rogue-armor-prof',
        name: 'Light Armor Proficiency',
        description: '',
        effects: [
          {
            kind: 'grantProficiency',
            profType: 'armor',
            values: ['Light armor'],
          },
        ],
      };

      const effects = [lightArmorProf, leatherArmor, bracersOfDefense];
      const derived = evaluateCharacter(facts, effects);

      // Leather armor: 11 + DEX (3) = 14
      // Bracers: NOT applied (wearing armor)
      expect(derived.ac.value).toBe(14);
      expect(derived.tags).toContain('wearing-armor');
    });

    it('should set ability score to 19 with magic item', () => {
      const facts: BaseFacts = {
        level: 3,
        classSlug: 'fighter',
        classLevel: { fighter: 3 },
        subclassSlug: '',
        speciesSlug: 'halfling',
        lineageSlug: '',
        backgroundSlug: 'soldier',
        edition: '2014',
        abilities: {
          STR: 12, // Low strength
          DEX: 14,
          CON: 14,
          INT: 10,
          WIS: 10,
          CHA: 10,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: ['attuned:gauntlets-ogre-power'],
        feats: [],
        resourceUsage: {},
      };

      const effects = [gauntletsOfOgrePower];
      const derived = evaluateCharacter(facts, effects);

      // Gauntlets set STR to 19
      expect(derived.abilities.STR.score).toBe(19);
      expect(derived.abilities.STR.modifier).toBe(4);
    });

    it('should NOT affect ability score if already 19 or higher', () => {
      const facts: BaseFacts = {
        level: 10,
        classSlug: 'barbarian',
        classLevel: { barbarian: 10 },
        subclassSlug: '',
        speciesSlug: 'half-orc',
        lineageSlug: '',
        backgroundSlug: 'outlander',
        edition: '2014',
        abilities: {
          STR: 20, // Already high
          DEX: 14,
          CON: 18,
          INT: 8,
          WIS: 10,
          CHA: 8,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: ['attuned:gauntlets-ogre-power'],
        feats: [],
        resourceUsage: {},
      };

      const effects = [gauntletsOfOgrePower];
      const derived = evaluateCharacter(facts, effects);

      // Gauntlets have no effect (STR already 20)
      expect(derived.abilities.STR.score).toBe(20);
      expect(derived.abilities.STR.modifier).toBe(5);
    });

    it('should stack multiple magic item bonuses', () => {
      const facts: BaseFacts = {
        level: 7,
        classSlug: 'paladin',
        classLevel: { paladin: 7 },
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
        equippedArmor: 'chain-mail',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: ['attuned:ring-of-protection', 'attuned:cloak-of-protection'],
        feats: [],
        resourceUsage: {},
      };

      // Paladin proficiencies (heavy armor)
      const paladinProficiencies: any = {
        sourceId: 'class:paladin',
        effectId: 'paladin-armor-prof',
        name: 'Paladin Armor Proficiency',
        description: '',
        effects: [
          {
            kind: 'grantProficiency',
            profType: 'armor',
            values: ['Light armor', 'Medium armor', 'Heavy armor', 'Shields'],
          },
        ],
      };

      const effects = [paladinProficiencies, chainMail, ringOfProtection, cloakOfProtection];
      const derived = evaluateCharacter(facts, effects);

      // Chain mail (16) + Ring (+1) + Cloak (+1) = 18
      expect(derived.ac.value).toBe(18);
    });
  });

  describe('Attunement System', () => {
    it('should initialize attunement with 3 max slots', () => {
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

      expect(derived.attunement.maxAttunedItems).toBe(3);
      expect(derived.attunement.attunedItems).toEqual([]);
    });
  });

  describe('Equipment Tags', () => {
    it('should apply wearing-armor tag from armor', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'fighter',
        classLevel: { fighter: 1 },
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
          WIS: 10,
          CHA: 10,
        },
        choices: {},
        equippedArmor: 'chain-mail',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects = [...fighterProficiencies, chainMail];
      const derived = evaluateCharacter(facts, effects);

      expect(derived.tags).toContain('wearing-armor');
      expect(derived.tags).toContain('wearing-heavy-armor');
    });

    it('should apply wielding-shield tag from shield', () => {
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
          WIS: 16,
          CHA: 12,
        },
        choices: {},
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: ['shield'],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      // Cleric has shield proficiency
      const clericProficiencies: any = {
        sourceId: 'class:cleric',
        effectId: 'cleric-proficiencies',
        name: 'Cleric Proficiencies',
        description: '',
        effects: [
          {
            kind: 'grantProficiency',
            profType: 'armor',
            values: ['Light armor', 'Medium armor', 'Shields'],
          },
        ],
      };

      const effects = [clericProficiencies, shield];
      const derived = evaluateCharacter(facts, effects);

      expect(derived.tags).toContain('wielding-shield');
    });
  });
});
