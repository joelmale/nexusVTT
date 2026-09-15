/**
 * Combat Resolver Tests
 * Tests for combat_001_attack_resolution
 */

import { describe, it, expect } from 'vitest';
import {
  resolveAttack,
  resolveSavingThrow,
  rollDamage,
  type AttackAction,
  type SavingThrowAction,
} from '../resolvers/combatResolver';
import { initializeCharacterState } from '../state/initializeState';
import type { DerivedStats } from '../types/derived';

describe('Combat Resolver', () => {
  const mockAttackerDerived: DerivedStats = {
    hitPoints: 25,
    proficiencyBonus: 2,
    speed: { walk: 30 },
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      savingThrows: ['STR', 'CON'],
      skills: [],
      languages: [],
    },
    resources: {},
    features: [],
    tags: [],
  };

  const mockDefenderDerived: DerivedStats = {
    hitPoints: 20,
    proficiencyBonus: 2,
    speed: { walk: 30 },
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      savingThrows: ['DEX', 'INT'],
      skills: [],
      languages: [],
    },
    resources: {},
    features: [],
    tags: [],
  };

  // Seeded RNG for deterministic tests
  // This RNG cycles through values and returns normalized 0-1 values
  const createSeededRNG = (values: number[]) => {
    let index = 0;
    return () => {
      const value = values[index % values.length];
      index++;
      // Normalize to 0-1 range
      // For most dice (d4-d20), this gives reasonable distribution
      return value / 20;
    };
  };

  // Create RNG specifically for d20 rolls
  const createD20RNG = (values: number[]) => {
    let index = 0;
    return () => {
      const value = values[index % values.length];
      index++;
      // For d20: to get value V, return (V-1)/20
      return (value - 1) / 20;
    };
  };

  // Create combined RNG for both d20 and damage dice
  // Specify which values are for d20 vs damage dice
  const createMixedRNG = (spec: Array<{ value: number; isD20: boolean }>) => {
    let index = 0;
    return () => {
      const { value, isD20 } = spec[index % spec.length];
      index++;
      if (isD20) {
        return (value - 1) / 20; // d20 formula
      } else {
        return value / 20; // General dice formula (works reasonably for d4-d12)
      }
    };
  };

  describe('rollDamage', () => {
    it('should roll normal damage', () => {
      // For d6: to get 4, need rng()*6 in [3,4), so rng() in [0.5, 0.666...)
      // For d6: to get 3, need rng()*6 in [2,3), so rng() in [0.333..., 0.5)
      const rng = createSeededRNG([11, 7]); // 11/20=0.55 -> floor(0.55*6)+1=4, 7/20=0.35 -> floor(0.35*6)+1=3
      const result = rollDamage('2d6+3', false, 'slashing', rng);

      expect(result.rolls).toEqual([4, 3]);
      expect(result.total).toBe(10); // 4 + 3 + 3
      expect(result.damageType).toBe('slashing');
      expect(result.isCritical).toBe(false);
    });

    it('should double dice on critical hit', () => {
      // For d6: 11/20=0.55 -> 4, 7/20=0.35 -> 3, 14/20=0.7 -> 5, 4/20=0.2 -> 2
      const rng = createSeededRNG([11, 7, 14, 4]);
      const result = rollDamage('2d6+3', true, 'slashing', rng);

      expect(result.rolls).toEqual([4, 3, 5, 2]); // 4 dice instead of 2
      expect(result.total).toBe(17); // 4 + 3 + 5 + 2 + 3
      expect(result.isCritical).toBe(true);
    });

    it('should handle single die damage', () => {
      // For d8: to get 6, need rng()*8 in [5,6), so rng() in [0.625, 0.75)
      const rng = createSeededRNG([13]); // 13/20=0.65 -> floor(0.65*8)+1=6
      const result = rollDamage('1d8+2', false, 'piercing', rng);

      expect(result.rolls).toEqual([6]);
      expect(result.total).toBe(8); // 6 + 2
    });

    it('should handle damage without modifier', () => {
      // For d6: to get 5, need rng() in [0.666..., 0.833...), to get 4 need [0.5, 0.666...)
      const rng = createSeededRNG([14, 11]); // 14/20=0.7 -> 5, 11/20=0.55 -> 4
      const result = rollDamage('2d6', false, 'fire', rng);

      expect(result.rolls).toEqual([5, 4]);
      expect(result.total).toBe(9); // 5 + 4 + 0
    });

    it('should handle negative modifiers', () => {
      // For d8: to get 6, need rng() in [0.625, 0.75)
      const rng = createSeededRNG([13]); // 13/20=0.65 -> 6
      const result = rollDamage('1d8-2', false, 'bludgeoning', rng);

      expect(result.rolls).toEqual([6]);
      expect(result.total).toBe(4); // 6 - 2
    });

    it('should not go below 0 damage', () => {
      const rng = createSeededRNG([1]);
      const result = rollDamage('1d4-5', false, 'cold', rng);

      expect(result.total).toBe(0); // max(0, 1 - 5)
    });
  });

  describe('resolveAttack', () => {
    it('should resolve a successful attack', () => {
      const attacker = initializeCharacterState('attacker', mockAttackerDerived);
      const defender = initializeCharacterState('defender', mockDefenderDerived);

      const action: AttackAction = {
        attacker,
        defender,
        attackBonus: 5,
        damageDice: '1d8+3',
        damageType: 'slashing',
        isMeleeWithin5Feet: true,
      };

      // Attack roll: 15 (d20), Damage roll: 6 (d8)
      const rng = createMixedRNG([
        { value: 15, isD20: true },
        { value: 13, isD20: false }, // 13/20=0.65 -> floor(0.65*8)+1=6
      ]);
      const result = resolveAttack(action, 14, rng);

      expect(result.isHit).toBe(true);
      expect(result.attackRoll.total).toBe(20); // 15 + 5
      expect(result.damageRoll?.total).toBe(9); // 6 + 3
      expect(result.defenderState?.currentHP).toBe(11); // 20 - 9
      expect(result.log).toContain('Hit! (AC 14)');
    });

    it('should resolve a missed attack', () => {
      const attacker = initializeCharacterState('attacker', mockAttackerDerived);
      const defender = initializeCharacterState('defender', mockDefenderDerived);

      const action: AttackAction = {
        attacker,
        defender,
        attackBonus: 5,
        damageDice: '1d8+3',
        damageType: 'slashing',
        isMeleeWithin5Feet: true,
      };

      // Attack roll: 8 (d20)
      const rng = createD20RNG([8]);
      const result = resolveAttack(action, 16, rng);

      expect(result.isHit).toBe(false);
      expect(result.attackRoll.total).toBe(13); // 8 + 5
      expect(result.damageRoll).toBeUndefined();
      expect(result.defenderState).toBeUndefined();
      expect(result.log).toContain('Miss! (AC 16)');
    });

    it('should resolve a natural 20 critical hit', () => {
      const attacker = initializeCharacterState('attacker', mockAttackerDerived);
      const defender = initializeCharacterState('defender', mockDefenderDerived);

      const action: AttackAction = {
        attacker,
        defender,
        attackBonus: 5,
        damageDice: '1d8+3',
        damageType: 'slashing',
        isMeleeWithin5Feet: true,
      };

      // Attack roll: 20 (d20), Damage rolls: 6, 7 (d8, doubled)
      const rng = createMixedRNG([
        { value: 20, isD20: true },
        { value: 13, isD20: false }, // 13/20=0.65 -> floor(0.65*8)+1=6
        { value: 14, isD20: false }, // 14/20=0.7 -> floor(0.7*8)+1=6... wait need 7
      ]);
      const result = resolveAttack(action, 25, rng);

      expect(result.isHit).toBe(true); // Nat 20 always hits
      expect(result.attackRoll.isNaturalTwenty).toBe(true);
      expect(result.damageRoll?.isCritical).toBe(true);
      expect(result.damageRoll?.rolls).toHaveLength(2); // 2 dice for crit
      expect(result.log).toContain('Critical hit!');
    });

    it('should apply auto-crit from paralyzed condition', () => {
      const attacker = initializeCharacterState('attacker', mockAttackerDerived);
      const defender = initializeCharacterState('defender', mockDefenderDerived);

      // Defender is paralyzed
      defender.conditions.push({
        condition: 'paralyzed',
        source: 'hold-person',
        duration: 1,
      });

      const action: AttackAction = {
        attacker,
        defender,
        attackBonus: 5,
        damageDice: '1d8+3',
        damageType: 'slashing',
        isMeleeWithin5Feet: true,
      };

      // Attack roll: 10 (hits due to advantage from paralyzed)
      // Damage rolls: 5, 6 (doubled due to auto-crit)
      const rng = createSeededRNG([10, 12, 5, 6]);
      const result = resolveAttack(action, 14, rng);

      expect(result.isHit).toBe(true);
      expect(result.damageRoll?.isCritical).toBe(true);
      expect(result.damageRoll?.rolls).toHaveLength(2); // Doubled dice
      expect(result.log).toContain('Critical hit!');
    });

    it('should apply disadvantage from prone attacker', () => {
      const attacker = initializeCharacterState('attacker', mockAttackerDerived);
      const defender = initializeCharacterState('defender', mockDefenderDerived);

      // Attacker is prone
      attacker.conditions.push({
        condition: 'prone',
        source: 'trip-attack',
        duration: 0,
      });

      const action: AttackAction = {
        attacker,
        defender,
        attackBonus: 5,
        damageDice: '1d8+3',
        damageType: 'slashing',
        isMeleeWithin5Feet: true,
      };

      // Attack rolls: 15, 8 (disadvantage takes lower)
      const rng = createD20RNG([15, 8]);
      const result = resolveAttack(action, 14, rng);

      expect(result.attackRoll.rollState).toBe('disadvantage');
      expect(result.attackRoll.finalRoll).toBe(8); // Takes lower
      expect(result.isHit).toBe(false); // 8 + 5 = 13 < 14
    });

    it('should apply advantage against prone defender (melee)', () => {
      const attacker = initializeCharacterState('attacker', mockAttackerDerived);
      const defender = initializeCharacterState('defender', mockDefenderDerived);

      // Defender is prone
      defender.conditions.push({
        condition: 'prone',
        source: 'trip-attack',
        duration: 0,
      });

      const action: AttackAction = {
        attacker,
        defender,
        attackBonus: 5,
        damageDice: '1d8+3',
        damageType: 'slashing',
        isMeleeWithin5Feet: true,
      };

      // Attack rolls: 8, 15 (advantage takes higher)
      const rng = createD20RNG([8, 15]);
      const result = resolveAttack(action, 14, rng);

      expect(result.attackRoll.rollState).toBe('advantage');
      expect(result.attackRoll.finalRoll).toBe(15); // Takes higher
      expect(result.isHit).toBe(true); // 15 + 5 = 20 > 14
    });

    it('should consume temp HP first', () => {
      const attacker = initializeCharacterState('attacker', mockAttackerDerived);
      const defender = initializeCharacterState('defender', mockDefenderDerived);
      defender.tempHP = 5;

      const action: AttackAction = {
        attacker,
        defender,
        attackBonus: 5,
        damageDice: '1d8+3',
        damageType: 'slashing',
        isMeleeWithin5Feet: true,
      };

      // Attack roll: 15 (d20), Damage roll: 6 (d8)
      const rng = createMixedRNG([
        { value: 15, isD20: true },
        { value: 13, isD20: false }, // 13/20=0.65 -> floor(0.65*8)+1=6
      ]);
      const result = resolveAttack(action, 14, rng);

      expect(result.defenderState?.tempHP).toBe(0); // 5 - 5 = 0
      expect(result.defenderState?.currentHP).toBe(16); // 20 - 4 (after temp absorbed 5)
    });
  });

  describe('resolveSavingThrow', () => {
    it('should resolve a successful save', () => {
      const character = initializeCharacterState('char', mockAttackerDerived);

      const action: SavingThrowAction = {
        character,
        saveDC: 15,
        ability: 'DEX',
        saveBonus: 5,
      };

      // Save roll: 12 (total 17 > DC 15)
      const rng = createD20RNG([12]);
      const result = resolveSavingThrow(action, rng);

      expect(result.success).toBe(true);
      expect(result.saveRoll.total).toBe(17); // 12 + 5
      expect(result.log).toContain('Success! (DC 15)');
    });

    it('should resolve a failed save', () => {
      const character = initializeCharacterState('char', mockAttackerDerived);

      const action: SavingThrowAction = {
        character,
        saveDC: 15,
        ability: 'DEX',
        saveBonus: 3,
      };

      // Save roll: 10 (total 13 < DC 15)
      const rng = createD20RNG([10]);
      const result = resolveSavingThrow(action, rng);

      expect(result.success).toBe(false);
      expect(result.saveRoll.total).toBe(13); // 10 + 3
      expect(result.log).toContain('Failure! (DC 15)');
    });

    it('should apply half damage on successful save', () => {
      const character = initializeCharacterState('char', mockAttackerDerived);

      const action: SavingThrowAction = {
        character,
        saveDC: 15,
        ability: 'DEX',
        saveBonus: 5,
        damageOnSuccess: '4d6', // Half of 8d6
        damageOnFail: '8d6',
        damageType: 'fire',
      };

      // Save roll: 16 (d20 success), Damage: 4d6
      const rng = createMixedRNG([
        { value: 16, isD20: true },
        { value: 7, isD20: false }, // d6 rolls
        { value: 11, isD20: false },
        { value: 14, isD20: false },
        { value: 4, isD20: false },
      ]);
      const result = resolveSavingThrow(action, rng);

      expect(result.success).toBe(true);
      expect(result.damageRoll?.total).toBe(14);
      expect(result.characterState?.currentHP).toBe(11); // 25 - 14
      expect(result.log).toContain('Damage: 14 fire');
    });

    it('should apply full damage on failed save', () => {
      const character = initializeCharacterState('char', mockAttackerDerived);

      const action: SavingThrowAction = {
        character,
        saveDC: 15,
        ability: 'DEX',
        saveBonus: 2,
        damageOnSuccess: '4d6',
        damageOnFail: '8d6',
        damageType: 'fire',
      };

      // Save roll: 10 (d20 fail), Damage: 8d6
      const rng = createMixedRNG([
        { value: 10, isD20: true },
        { value: 7, isD20: false },
        { value: 11, isD20: false },
        { value: 14, isD20: false },
        { value: 4, isD20: false },
        { value: 15, isD20: false },
        { value: 3, isD20: false },
        { value: 7, isD20: false },
        { value: 11, isD20: false },
      ]);
      const result = resolveSavingThrow(action, rng);

      expect(result.success).toBe(false);
      expect(result.damageRoll?.total).toBeGreaterThan(0);
      expect(result.characterState?.currentHP).toBe(0); // Damage exceeds max HP, capped at 0
    });

    it('should auto-fail DEX save when stunned', () => {
      const character = initializeCharacterState('char', mockAttackerDerived);
      character.conditions.push({
        condition: 'stunned',
        source: 'stunning-strike',
        duration: 1,
      });

      const action: SavingThrowAction = {
        character,
        saveDC: 15,
        ability: 'DEX',
        saveBonus: 5,
        damageOnFail: '8d6',
        damageType: 'fire',
      };

      const rng = createSeededRNG([7, 11, 14, 4, 15, 3, 7, 11]); // d6 damage rolls
      const result = resolveSavingThrow(action, rng);

      expect(result.autoFail).toBe(true);
      expect(result.success).toBe(false);
      expect(result.log).toContain('DEX save auto-fails due to conditions');
      expect(result.damageRoll?.total).toBeGreaterThan(0);
    });

    it('should auto-fail STR save when paralyzed', () => {
      const character = initializeCharacterState('char', mockAttackerDerived);
      character.conditions.push({
        condition: 'paralyzed',
        source: 'hold-person',
        duration: 1,
      });

      const action: SavingThrowAction = {
        character,
        saveDC: 12,
        ability: 'STR',
        saveBonus: 4,
      };

      const result = resolveSavingThrow(action);

      expect(result.autoFail).toBe(true);
      expect(result.success).toBe(false);
      expect(result.log).toContain('STR save auto-fails due to conditions');
    });

    it('should not auto-fail CON save when stunned', () => {
      const character = initializeCharacterState('char', mockAttackerDerived);
      character.conditions.push({
        condition: 'stunned',
        source: 'stunning-strike',
        duration: 1,
      });

      const action: SavingThrowAction = {
        character,
        saveDC: 15,
        ability: 'CON',
        saveBonus: 5,
      };

      // CON saves are not auto-failed by stunned (only STR and DEX)
      const rng = createSeededRNG([12]);
      const result = resolveSavingThrow(action, rng);

      expect(result.autoFail).toBe(false);
      expect(result.success).toBe(true); // 12 + 5 = 17 > 15
    });

    it('should apply disadvantage on saves from restrained', () => {
      const character = initializeCharacterState('char', mockAttackerDerived);
      character.conditions.push({
        condition: 'restrained',
        source: 'web-spell',
        duration: 0,
      });

      const action: SavingThrowAction = {
        character,
        saveDC: 15,
        ability: 'DEX',
        saveBonus: 5,
      };

      // Roll twice (disadvantage), take lower: 15 and 8
      const rng = createD20RNG([15, 8]);
      const result = resolveSavingThrow(action, rng);

      expect(result.saveRoll.rollState).toBe('disadvantage');
      expect(result.saveRoll.finalRoll).toBe(8); // Takes lower
      expect(result.success).toBe(false); // 8 + 5 = 13 < 15
    });
  });

  describe('Edge cases', () => {
    it('should handle 0 HP defender', () => {
      const attacker = initializeCharacterState('attacker', mockAttackerDerived);
      const defender = initializeCharacterState('defender', mockDefenderDerived);
      defender.currentHP = 0;

      const action: AttackAction = {
        attacker,
        defender,
        attackBonus: 5,
        damageDice: '1d8+3',
        damageType: 'slashing',
        isMeleeWithin5Feet: true,
      };

      const rng = createSeededRNG([15, 6]);
      const result = resolveAttack(action, 14, rng);

      expect(result.isHit).toBe(true);
      expect(result.defenderState?.currentHP).toBe(0); // Stays at 0
    });

    it('should handle massive damage', () => {
      const attacker = initializeCharacterState('attacker', mockAttackerDerived);
      const defender = initializeCharacterState('defender', mockDefenderDerived);
      defender.currentHP = 5;

      const action: AttackAction = {
        attacker,
        defender,
        attackBonus: 5,
        damageDice: '10d10+10',
        damageType: 'force',
        isMeleeWithin5Feet: true,
      };

      const rng = createSeededRNG([15, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
      const result = resolveAttack(action, 14, rng);

      expect(result.defenderState?.currentHP).toBe(0); // Capped at 0, not negative
    });
  });
});
