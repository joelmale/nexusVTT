/**
 * Phase 6 Tests: Features & Resources
 * Tests for class features, resources, and choices
 */

import { describe, it, expect } from 'vitest';
import { evaluateCharacter } from '../executors/characterExecutor';
import type { BaseFacts } from '../types/baseFacts';
import { fighterEffects } from '../content/classes/fighter';
import { barbarianEffects } from '../content/classes/barbarian';
import { monkEffects } from '../content/classes/monk';
import { sorcererEffects } from '../content/classes/sorcerer';

describe('Phase 6: Features & Resources', () => {
  describe('Feature Granting', () => {
    it('should grant Fighter Second Wind feature at level 1', () => {
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

      const derived = evaluateCharacter(facts, fighterEffects);

      // Should have Second Wind feature
      const secondWindFeature = derived.features.find((f) => f.id === 'second-wind');
      expect(secondWindFeature).toBeDefined();
      expect(secondWindFeature?.name).toBe('Second Wind');

      // Should have Second Wind tag
      expect(derived.tags).toContain('second-wind');
    });

    it('should grant Barbarian Rage feature at level 1', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'barbarian',
        classLevel: { barbarian: 1 },
        subclassSlug: '',
        speciesSlug: 'half-orc',
        lineageSlug: '',
        backgroundSlug: 'outlander',
        edition: '2014',
        abilities: {
          STR: 16,
          DEX: 14,
          CON: 16,
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

      const derived = evaluateCharacter(facts, barbarianEffects);

      // Should have Rage feature
      const rageFeature = derived.features.find((f) => f.id === 'rage');
      expect(rageFeature).toBeDefined();
      expect(rageFeature?.name).toBe('Rage');

      // Should have Unarmored Defense feature
      const unarmoredDefense = derived.features.find((f) => f.id === 'unarmored-defense-barbarian');
      expect(unarmoredDefense).toBeDefined();
    });

    it('should grant Monk Ki feature at level 2', () => {
      const facts: BaseFacts = {
        level: 2,
        classSlug: 'monk',
        classLevel: { monk: 2 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'hermit',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 16,
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

      const derived = evaluateCharacter(facts, monkEffects);

      // Should have Ki feature
      const kiFeature = derived.features.find((f) => f.id === 'ki');
      expect(kiFeature).toBeDefined();
      expect(kiFeature?.name).toBe('Ki');

      // Should have ki-powered abilities
      expect(derived.features.find((f) => f.id === 'flurry-of-blows')).toBeDefined();
      expect(derived.features.find((f) => f.id === 'patient-defense')).toBeDefined();
      expect(derived.features.find((f) => f.id === 'step-of-wind')).toBeDefined();
    });

    it('should NOT grant level 2 features at level 1', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'monk',
        classLevel: { monk: 1 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'hermit',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 16,
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

      const derived = evaluateCharacter(facts, monkEffects);

      // Should NOT have Ki feature at level 1
      const kiFeature = derived.features.find((f) => f.id === 'ki');
      expect(kiFeature).toBeUndefined();

      // Should still have level 1 features
      expect(derived.features.find((f) => f.id === 'unarmored-defense-monk')).toBeDefined();
      expect(derived.features.find((f) => f.id === 'martial-arts')).toBeDefined();
    });
  });

  describe('Resource Calculations', () => {
    it('should calculate Fighter Second Wind resource (1 per short rest)', () => {
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

      const derived = evaluateCharacter(facts, fighterEffects);

      // Should have 1 Second Wind use per short rest
      const secondWind = Object.values(derived.resources).find((r) => r.id === 'second-wind');
      expect(secondWind).toBeDefined();
      expect(secondWind?.current).toBe(1);
      expect(secondWind?.max).toBe(1);
      expect(secondWind?.type).toBe('perShortRest');
    });

    it('should calculate Barbarian Rage uses at level 1 (2 uses)', () => {
      const facts: BaseFacts = {
        level: 1,
        classSlug: 'barbarian',
        classLevel: { barbarian: 1 },
        subclassSlug: '',
        speciesSlug: 'half-orc',
        lineageSlug: '',
        backgroundSlug: 'outlander',
        edition: '2014',
        abilities: {
          STR: 16,
          DEX: 14,
          CON: 16,
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

      const derived = evaluateCharacter(facts, barbarianEffects);

      // Should have 2 Rage uses at level 1
      const rage = Object.values(derived.resources).find((r) => r.id === 'rage');
      expect(rage).toBeDefined();
      expect(rage?.current).toBe(2);
      expect(rage?.max).toBe(2);
      expect(rage?.type).toBe('perLongRest');
    });

    it('should scale Barbarian Rage uses at level 3 (3 uses)', () => {
      const facts: BaseFacts = {
        level: 3,
        classSlug: 'barbarian',
        classLevel: { barbarian: 3 },
        subclassSlug: '',
        speciesSlug: 'half-orc',
        lineageSlug: '',
        backgroundSlug: 'outlander',
        edition: '2014',
        abilities: {
          STR: 16,
          DEX: 14,
          CON: 16,
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

      const derived = evaluateCharacter(facts, barbarianEffects);

      // Should have 3 Rage uses at level 3 (2 base + 1 from level 3)
      const rage = Object.values(derived.resources).find((r) => r.id === 'rage');
      expect(rage).toBeDefined();
      expect(rage?.current).toBe(3);
      expect(rage?.max).toBe(3);
    });

    it('should scale Barbarian Rage uses at level 6 (4 uses)', () => {
      const facts: BaseFacts = {
        level: 6,
        classSlug: 'barbarian',
        classLevel: { barbarian: 6 },
        subclassSlug: '',
        speciesSlug: 'half-orc',
        lineageSlug: '',
        backgroundSlug: 'outlander',
        edition: '2014',
        abilities: {
          STR: 18,
          DEX: 14,
          CON: 16,
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

      const derived = evaluateCharacter(facts, barbarianEffects);

      // Should have 4 Rage uses at level 6 (2 + 1 + 1)
      const rage = Object.values(derived.resources).find((r) => r.id === 'rage');
      expect(rage).toBeDefined();
      expect(rage?.current).toBe(4);
      expect(rage?.max).toBe(4);
    });

    it('should calculate Monk Ki Points equal to monk level', () => {
      const facts: BaseFacts = {
        level: 5,
        classSlug: 'monk',
        classLevel: { monk: 5 },
        subclassSlug: '',
        speciesSlug: 'human',
        lineageSlug: '',
        backgroundSlug: 'hermit',
        edition: '2014',
        abilities: {
          STR: 10,
          DEX: 16,
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

      const derived = evaluateCharacter(facts, monkEffects);

      // Should have 5 Ki Points at level 5 (equals monk level)
      const kiPoints = Object.values(derived.resources).find((r) => r.id === 'ki-points');
      expect(kiPoints).toBeDefined();
      expect(kiPoints?.current).toBe(5);
      expect(kiPoints?.max).toBe(5);
      expect(kiPoints?.type).toBe('perShortRest');
    });

    it('should calculate Sorcerer Sorcery Points equal to sorcerer level', () => {
      const facts: BaseFacts = {
        level: 7,
        classSlug: 'sorcerer',
        classLevel: { sorcerer: 7 },
        subclassSlug: '',
        speciesSlug: 'tiefling',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2014',
        abilities: {
          STR: 8,
          DEX: 14,
          CON: 14,
          INT: 10,
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

      const derived = evaluateCharacter(facts, sorcererEffects);

      // Should have 7 Sorcery Points at level 7 (equals sorcerer level)
      const sorceryPoints = Object.values(derived.resources).find((r) => r.id === 'sorcery-points');
      expect(sorceryPoints).toBeDefined();
      expect(sorceryPoints?.current).toBe(7);
      expect(sorceryPoints?.max).toBe(7);
      expect(sorceryPoints?.type).toBe('perLongRest');
    });
  });

  describe('Resource Types', () => {
    it('should track perShortRest resources (Fighter Second Wind)', () => {
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

      const derived = evaluateCharacter(facts, fighterEffects);

      const secondWind = Object.values(derived.resources).find((r) => r.id === 'second-wind');
      expect(secondWind?.type).toBe('perShortRest');
    });

    it('should track perShortRest resources (Monk Ki Points)', () => {
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
          DEX: 16,
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

      const derived = evaluateCharacter(facts, monkEffects);

      const kiPoints = Object.values(derived.resources).find((r) => r.id === 'ki-points');
      expect(kiPoints?.type).toBe('perShortRest');
    });

    it('should track perLongRest resources (Barbarian Rage)', () => {
      const facts: BaseFacts = {
        level: 3,
        classSlug: 'barbarian',
        classLevel: { barbarian: 3 },
        subclassSlug: '',
        speciesSlug: 'half-orc',
        lineageSlug: '',
        backgroundSlug: 'outlander',
        edition: '2014',
        abilities: {
          STR: 16,
          DEX: 14,
          CON: 16,
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

      const derived = evaluateCharacter(facts, barbarianEffects);

      const rage = Object.values(derived.resources).find((r) => r.id === 'rage');
      expect(rage?.type).toBe('perLongRest');
    });

    it('should track perLongRest resources (Sorcerer Sorcery Points)', () => {
      const facts: BaseFacts = {
        level: 5,
        classSlug: 'sorcerer',
        classLevel: { sorcerer: 5 },
        subclassSlug: '',
        speciesSlug: 'tiefling',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2014',
        abilities: {
          STR: 8,
          DEX: 14,
          CON: 14,
          INT: 10,
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

      const derived = evaluateCharacter(facts, sorcererEffects);

      const sorceryPoints = Object.values(derived.resources).find((r) => r.id === 'sorcery-points');
      expect(sorceryPoints?.type).toBe('perLongRest');
    });
  });

  describe('Feature Choices', () => {
    it('should present Fighting Style choice for Fighter at level 1', () => {
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

      const derived = evaluateCharacter(facts, fighterEffects);

      // Should have Fighting Style choice available
      const fightingStyleChoice = derived.choices.find((c) => c.id === 'fighting-style');
      expect(fightingStyleChoice).toBeDefined();
      expect(fightingStyleChoice?.prompt).toBe('Choose your Fighting Style');
      expect(fightingStyleChoice?.options.length).toBe(6);
    });

    it('should present Metamagic choice for Sorcerer at level 3', () => {
      const facts: BaseFacts = {
        level: 3,
        classSlug: 'sorcerer',
        classLevel: { sorcerer: 3 },
        subclassSlug: '',
        speciesSlug: 'tiefling',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2014',
        abilities: {
          STR: 8,
          DEX: 14,
          CON: 14,
          INT: 10,
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

      const derived = evaluateCharacter(facts, sorcererEffects);

      // Should have Metamagic choice available
      const metamagicChoice = derived.choices.find((c) => c.id === 'metamagic');
      expect(metamagicChoice).toBeDefined();
      expect(metamagicChoice?.prompt).toBe('Choose two Metamagic options');
      expect(metamagicChoice?.min).toBe(2);
      expect(metamagicChoice?.max).toBe(2);
      expect(metamagicChoice?.options.length).toBe(8);
    });

    it('should NOT present level 3 choices at lower levels', () => {
      const facts: BaseFacts = {
        level: 2,
        classSlug: 'sorcerer',
        classLevel: { sorcerer: 2 },
        subclassSlug: '',
        speciesSlug: 'tiefling',
        lineageSlug: '',
        backgroundSlug: 'sage',
        edition: '2014',
        abilities: {
          STR: 8,
          DEX: 14,
          CON: 14,
          INT: 10,
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

      const derived = evaluateCharacter(facts, sorcererEffects);

      // Should NOT have Metamagic choice at level 2
      const metamagicChoice = derived.choices.find((c) => c.id === 'metamagic');
      expect(metamagicChoice).toBeUndefined();

      // Should have Font of Magic feature
      const fontOfMagic = derived.features.find((f) => f.id === 'font-of-magic');
      expect(fontOfMagic).toBeDefined();
    });
  });
});
