/**
 * Phase 5 Tests: Combat Stats & Movement
 * Tests for AC, initiative, and speed
 */

import { describe, it, expect } from 'vitest';
import { evaluateCharacter } from '../executors/characterExecutor';
import type { BaseFacts } from '../types/baseFacts';
import type { SourcedEffect } from '../types/effects';

describe('Phase 5: Combat Stats & Movement', () => {
  describe('Armor Class', () => {
    it('should calculate default unarmored AC (10 + DEX)', () => {
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
          DEX: 14, // +2 modifier
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

      const effects: SourcedEffect[] = [];
      const derived = evaluateCharacter(facts, effects);

      // Default AC = 10 + DEX (2) = 12
      expect(derived.ac.value).toBe(12);
    });

    it('should calculate AC with armor (additive priority)', () => {
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
          DEX: 14, // +2 modifier
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

      const effects: SourcedEffect[] = [
        {
          sourceId: 'item:chain-mail',
          effectId: 'chain-mail-ac',
          name: 'Chain Mail AC',
          description: 'AC 16 (heavy armor, no DEX bonus)',
          effects: [
            {
              kind: 'armorClass',
              value: 16,
              priority: 'additive',
              stacking: 'max',
            },
          ],
        },
      ];

      const derived = evaluateCharacter(facts, effects);

      // Chain mail AC = 16 (no DEX bonus for heavy armor in real rules, but we're just testing the effect system)
      expect(derived.ac.value).toBe(16);
    });

    it('should stack shield bonus on top of armor (flag priority)', () => {
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

      const effects: SourcedEffect[] = [
        {
          sourceId: 'item:chain-mail',
          effectId: 'chain-mail-ac',
          name: 'Chain Mail AC',
          description: 'AC 16',
          effects: [
            {
              kind: 'armorClass',
              value: 16,
              priority: 'additive',
              stacking: 'max',
            },
          ],
        },
        {
          sourceId: 'item:shield',
          effectId: 'shield-ac-bonus',
          name: 'Shield AC Bonus',
          description: '+2 AC',
          effects: [
            {
              kind: 'armorClass',
              value: 2,
              priority: 'flag',
              stacking: 'stack',
            },
          ],
        },
      ];

      const derived = evaluateCharacter(facts, effects);

      // Chain mail (16) + Shield (+2) = 18
      expect(derived.ac.value).toBe(18);
    });

    it('should handle unarmored defense (additive priority)', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'barbarian',
        classLevel: { barbarian: 1 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'outlander',
        edition: '2014',
        abilities: {
          STR: 16,
          DEX: 14, // +2
          CON: 16, // +3
          INT: 10,
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

      const effects: SourcedEffect[] = [
        {
          sourceId: 'class:barbarian',
          effectId: 'barbarian-unarmored-defense',
          name: 'Unarmored Defense',
          description: 'AC = 10 + DEX + CON while not wearing armor',
          effects: [
            {
              kind: 'armorClass',
              value: {
                expression: '10 + @abilities.DEX.modifier + @abilities.CON.modifier',
                variables: ['@abilities.DEX.modifier', '@abilities.CON.modifier'],
              },
              priority: 'additive',
              stacking: 'max',
              predicate: [
                { type: 'classIs', slug: 'barbarian' },
                { type: 'levelAtLeast', value: 1 },
              ],
            },
          ],
        },
      ];

      const derived = evaluateCharacter(facts, effects);

      // Unarmored Defense = 10 + DEX (2) + CON (3) = 15
      expect(derived.ac.value).toBe(15);
    });

    it('should pick highest AC calculation when multiple additive effects present', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'barbarian',
        classLevel: { barbarian: 1 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'outlander',
        edition: '2014',
        abilities: {
          STR: 16,
          DEX: 14, // +2
          CON: 16, // +3
          INT: 10,
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

      const effects: SourcedEffect[] = [
        {
          sourceId: 'class:barbarian',
          effectId: 'barbarian-unarmored-defense',
          name: 'Unarmored Defense',
          description: 'AC = 10 + DEX + CON',
          effects: [
            {
              kind: 'armorClass',
              value: {
                expression: '10 + @abilities.DEX.modifier + @abilities.CON.modifier',
                variables: ['@abilities.DEX.modifier', '@abilities.CON.modifier'],
              },
              priority: 'additive',
              stacking: 'max',
            },
          ],
        },
        {
          sourceId: 'item:leather-armor',
          effectId: 'leather-armor-ac',
          name: 'Leather Armor AC',
          description: 'AC = 11 + DEX',
          effects: [
            {
              kind: 'armorClass',
              value: {
                expression: '11 + @abilities.DEX.modifier',
                variables: ['@abilities.DEX.modifier'],
              },
              priority: 'additive',
              stacking: 'max',
            },
          ],
        },
      ];

      const derived = evaluateCharacter(facts, effects);

      // Unarmored Defense: 10 + 2 + 3 = 15
      // Leather Armor: 11 + 2 = 13
      // Should pick highest: 15
      expect(derived.ac.value).toBe(15);
    });
  });

  describe('Initiative', () => {
    it('should calculate initiative as DEX modifier by default', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'rogue',
        classLevel: { rogue: 1 },
        subclassSlug: '',
        speciesSlug: 'halfling',
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
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects: SourcedEffect[] = [];
      const derived = evaluateCharacter(facts, effects);

      // Initiative = DEX modifier = +4
      expect(derived.initiative.bonus).toBe(4);
    });

    it('should add initiative bonuses from effects', () => {
      const facts: BaseFacts = {
        level: 7,
        classSlug: 'bard',
        classLevel: { bard: 7 },
        subclassSlug: '',
        speciesSlug: 'half-elf',
        lineageSlug: '',
        backgroundSlug: 'entertainer',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 16, // +3 modifier
          CON: 12,
          INT: 12,
          WIS: 10,
          CHA: 18,
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
        {
          sourceId: 'feat:alert',
          effectId: 'alert-initiative-bonus',
          name: 'Alert',
          description: '+5 to initiative',
          effects: [
            {
              kind: 'initiativeBonus',
              value: 5,
              stacking: 'stack',
            },
          ],
        },
      ];

      const derived = evaluateCharacter(facts, effects);

      // Initiative = DEX (3) + Alert (5) = +8
      expect(derived.initiative.bonus).toBe(8);
    });

    it('should handle formula-based initiative bonuses', () => {
      const facts: BaseFacts = {
        level: 3,
        classSlug: 'wizard',
        classLevel: { wizard: 3 },
        subclassSlug: 'war-magic',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2024',
        abilities: {
          STR: 10,
          DEX: 14, // +2
          CON: 12,
          INT: 18, // +4
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

      const effects: SourcedEffect[] = [
        {
          sourceId: 'subclass:war-magic',
          effectId: 'tactical-wit',
          name: 'Tactical Wit',
          description: 'Add INT modifier to initiative',
          effects: [
            {
              kind: 'initiativeBonus',
              value: {
                expression: '@abilities.INT.modifier',
                variables: ['@abilities.INT.modifier'],
              },
              stacking: 'stack',
            },
          ],
        },
      ];

      const derived = evaluateCharacter(facts, effects);

      // Initiative = DEX (2) + INT (4) = +6
      expect(derived.initiative.bonus).toBe(6);
    });
  });

  describe('Speed', () => {
    it('should have correct speed from species', () => {
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
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      const effects: SourcedEffect[] = [
        {
          sourceId: 'species:human',
          effectId: 'human-speed',
          name: 'Human Speed',
          description: '30 feet walking speed',
          effects: [
            {
              kind: 'speed',
              movementType: 'walk',
              value: 30,
            },
          ],
        },
      ];

      const derived = evaluateCharacter(facts, effects);

      expect(derived.speed.walk).toBe(30);
    });

    it('should handle multiple movement types', () => {
      const facts: BaseFacts = {
        level: 5,
        classSlug: 'druid',
        classLevel: { druid: 5 },
        subclassSlug: '',
        speciesSlug: 'aarakocra',
        lineageSlug: '',
        backgroundSlug: 'outlander',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 14,
          CON: 12,
          INT: 10,
          WIS: 16,
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

      const effects: SourcedEffect[] = [
        {
          sourceId: 'species:aarakocra',
          effectId: 'aarakocra-speed',
          name: 'Aarakocra Speed',
          description: '25 feet walking, 50 feet flying',
          effects: [
            {
              kind: 'speed',
              movementType: 'walk',
              value: 25,
            },
            {
              kind: 'speed',
              movementType: 'fly',
              value: 50,
            },
          ],
        },
      ];

      const derived = evaluateCharacter(facts, effects);

      expect(derived.speed.walk).toBe(25);
      expect(derived.speed.fly).toBe(50);
    });
  });
});
