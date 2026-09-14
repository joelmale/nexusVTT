/**
 * Phase 2 Tests: Ability Scores & Saves
 * Tests for formula evaluation, saves, and skills
 */

import { describe, it, expect } from 'vitest';
import { evaluateCharacter } from '../executors/characterExecutor';
import { clericDivineOrder2024 } from '../content/classes/cleric';
import type { BaseFacts } from '../types/baseFacts';
import type { SourcedEffect } from '../types/effects';

describe('Phase 2: Ability Scores & Saves', () => {
  describe('Formula Evaluation', () => {
    it('should evaluate Divine Order Thaumaturge skill bonuses using formulas', () => {
      // Create a level 1 Cleric with 16 WIS (+3 modifier)
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'cleric',
        classLevel: { cleric: 1 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'acolyte',
        edition: '2024',
        abilities: {
          STR: 10,
          DEX: 10,
          CON: 10,
          INT: 10,
          WIS: 16, // +3 modifier
          CHA: 10,
        },
        choices: {
          'divine-order': 'thaumaturge',
        },
        equippedArmor: '',
        equippedWeapons: [],
        equippedItems: [],
        conditions: [],
        tags: [],
        feats: [],
        resourceUsage: {},
      };

      // Apply Divine Order Thaumaturge effect
      const effects: SourcedEffect[] = [clericDivineOrder2024];

      const derived = evaluateCharacter(facts, effects);

      // Thaumaturge grants WIS modifier (+3) to Arcana and Religion
      expect(derived.skills['Arcana'].bonus).toBe(3); // INT modifier (0) + WIS modifier (3)
      expect(derived.skills['Religion'].bonus).toBe(3); // INT modifier (0) + WIS modifier (3)
    });
  });

  describe('Saving Throws', () => {
    it('should calculate save bonuses with proficiency', () => {
      const facts: BaseFacts = {
        level: 5, // Proficiency bonus: +3
        classSlug: 'cleric',
        classLevel: { cleric: 5 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'acolyte',
        edition: '2024',
        abilities: {
          STR: 10, // +0
          DEX: 10, // +0
          CON: 10, // +0
          INT: 10, // +0
          WIS: 16, // +3
          CHA: 14, // +2
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

      // Cleric has WIS and CHA save proficiency
      const effects: SourcedEffect[] = [
        {
          sourceId: 'class:cleric',
          effectId: 'cleric-saves',
          name: 'Cleric Saves',
          description: 'Proficiency in Wisdom and Charisma saving throws',
          effects: [
            {
              kind: 'grantProficiency',
              profType: 'savingThrow',
              values: ['WIS', 'CHA'],
            },
          ],
        },
      ];

      const derived = evaluateCharacter(facts, effects);

      // Proficient saves
      expect(derived.saves.WIS.proficient).toBe(true);
      expect(derived.saves.WIS.bonus).toBe(6); // WIS modifier (3) + proficiency (3)

      expect(derived.saves.CHA.proficient).toBe(true);
      expect(derived.saves.CHA.bonus).toBe(5); // CHA modifier (2) + proficiency (3)

      // Non-proficient saves
      expect(derived.saves.STR.proficient).toBe(false);
      expect(derived.saves.STR.bonus).toBe(0); // STR modifier (0)
    });

    it('should track save advantage from Gnome Cunning', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'wizard',
        classLevel: { wizard: 1 },
        subclassSlug: '',
        speciesSlug: 'gnome',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2024',
        abilities: {
          STR: 10,
          DEX: 10,
          CON: 10,
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

      const effects: SourcedEffect[] = [
        {
          sourceId: 'species:gnome',
          effectId: 'gnomish-cunning',
          name: 'Gnome Cunning',
          description: 'Advantage on INT, WIS, and CHA saving throws against magic.',
          effects: [
            {
              kind: 'saveAdvantage',
              abilities: ['INT', 'WIS', 'CHA'],
            },
          ],
        },
      ];

      const derived = evaluateCharacter(facts, effects);

      // Should have advantage on mental saves
      expect(derived.saves.INT.advantage).toContain('species:gnome');
      expect(derived.saves.WIS.advantage).toContain('species:gnome');
      expect(derived.saves.CHA.advantage).toContain('species:gnome');

      // No advantage on physical saves
      expect(derived.saves.STR.advantage).toHaveLength(0);
      expect(derived.saves.DEX.advantage).toHaveLength(0);
      expect(derived.saves.CON.advantage).toHaveLength(0);
    });
  });

  describe('Skills', () => {
    it('should calculate skill bonuses with proficiency', () => {
      const facts: BaseFacts = {
        level: 3, // Proficiency bonus: +2
        classSlug: 'rogue',
        classLevel: { rogue: 3 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'criminal',
        edition: '2014',
        abilities: {
          STR: 10, // +0
          DEX: 16, // +3
          CON: 10, // +0
          INT: 14, // +2
          WIS: 12, // +1
          CHA: 10, // +0
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
          sourceId: 'background:criminal',
          effectId: 'criminal-skills',
          name: 'Criminal Skills',
          description: 'Proficiency in Stealth and Deception',
          effects: [
            {
              kind: 'skillProficiency',
              skill: 'Stealth',
            },
            {
              kind: 'skillProficiency',
              skill: 'Deception',
            },
          ],
        },
      ];

      const derived = evaluateCharacter(facts, effects);

      // Stealth: DEX-based, proficient
      expect(derived.skills['Stealth'].proficient).toBe(true);
      expect(derived.skills['Stealth'].bonus).toBe(5); // DEX modifier (3) + proficiency (2)

      // Deception: CHA-based, proficient
      expect(derived.skills['Deception'].proficient).toBe(true);
      expect(derived.skills['Deception'].bonus).toBe(2); // CHA modifier (0) + proficiency (2)

      // Investigation: INT-based, NOT proficient
      expect(derived.skills['Investigation'].proficient).toBe(false);
      expect(derived.skills['Investigation'].bonus).toBe(2); // INT modifier (2)
    });

    it('should double proficiency bonus for expertise', () => {
      const facts: BaseFacts = {
        level: 6, // Proficiency bonus: +3
        classSlug: 'bard',
        classLevel: { bard: 6 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'entertainer',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 14, // +2
          CON: 10,
          INT: 10,
          WIS: 10,
          CHA: 18, // +4
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
          sourceId: 'class:bard',
          effectId: 'bard-skills',
          name: 'Bard Skills',
          description: 'Proficiency in Performance',
          effects: [
            {
              kind: 'skillProficiency',
              skill: 'Performance',
            },
          ],
        },
        {
          sourceId: 'class:bard',
          effectId: 'bard-expertise',
          name: 'Expertise',
          description: 'Expertise in Performance and Persuasion',
          effects: [
            {
              kind: 'skillExpertise',
              skill: 'Performance',
            },
            {
              kind: 'skillExpertise',
              skill: 'Persuasion',
            },
          ],
        },
      ];

      const derived = evaluateCharacter(facts, effects);

      // Performance: CHA-based, expertise (double proficiency)
      expect(derived.skills['Performance'].proficient).toBe(true);
      expect(derived.skills['Performance'].expertise).toBe(true);
      expect(derived.skills['Performance'].bonus).toBe(10); // CHA (4) + proficiency (3) + expertise (3)

      // Persuasion: CHA-based, expertise but NO proficiency from this effect set
      // (Expertise still grants proficiency implicitly in D&D)
      expect(derived.skills['Persuasion'].expertise).toBe(true);
      expect(derived.skills['Persuasion'].bonus).toBe(10); // CHA (4) + proficiency (3) + expertise (3)
    });
  });

  describe('Proficiency Bonus', () => {
    it('should calculate correct proficiency bonus by level', () => {
      const testCases = [
        { level: 1, expected: 2 },
        { level: 4, expected: 2 },
        { level: 5, expected: 3 },
        { level: 8, expected: 3 },
        { level: 9, expected: 4 },
        { level: 12, expected: 4 },
        { level: 13, expected: 5 },
        { level: 16, expected: 5 },
        { level: 17, expected: 6 },
        { level: 20, expected: 6 },
      ];

      for (const { level, expected } of testCases) {
        const facts: BaseFacts = {
          level,
          classSlug: 'fighter',
          classLevel: { fighter: level },
          subclassSlug: '',
          speciesSlug: 'human',
          lineageSlug: '',
          backgroundSlug: 'soldier',
          edition: '2014',
          abilities: {
            STR: 10,
            DEX: 10,
            CON: 10,
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

        const derived = evaluateCharacter(facts, []);
        expect(derived.proficiencyBonus).toBe(expected);
      }
    });
  });
});
