/**
 * Condition Mechanics Tests
 * Tests for condition effects on rolls and combat
 */

import { describe, it, expect } from 'vitest';
import {
  applyConditionsToRoll,
  checkAutoFailSave,
  isIncapacitated,
  checkAutoCrit,
  CONDITION_MECHANICS,
} from '../mechanics/conditionMechanics';
import { createRollContext } from '../mechanics/rollMechanics';
import type { ActiveCondition } from '../types/state';

describe('Condition Mechanics', () => {
  describe('CONDITION_MECHANICS Database', () => {
    it('should have all standard D&D 5e conditions', () => {
      const expectedConditions = [
        'prone',
        'invisible',
        'poisoned',
        'frightened',
        'restrained',
        'stunned',
        'paralyzed',
        'unconscious',
        'charmed',
        'blinded',
        'deafened',
        'grappled',
        'petrified',
      ];

      expectedConditions.forEach((condition) => {
        expect(CONDITION_MECHANICS[condition]).toBeDefined();
        expect(CONDITION_MECHANICS[condition].condition).toBe(condition);
        expect(CONDITION_MECHANICS[condition].description).toBeTruthy();
      });
    });

    it('should define prone mechanics correctly', () => {
      const prone = CONDITION_MECHANICS.prone;

      expect(prone.attackRolls).toBe('disadvantage');
      expect(prone.incomingMeleeAttacks).toBe('advantage');
    });

    it('should define paralyzed mechanics correctly', () => {
      const paralyzed = CONDITION_MECHANICS.paralyzed;

      expect(paralyzed.incapacitated).toBe(true);
      expect(paralyzed.cannotMoveOrSpeak).toBe(true);
      expect(paralyzed.speedZero).toBe(true);
      expect(paralyzed.autoFailSaves).toEqual(['STR', 'DEX']);
      expect(paralyzed.incomingAttacks).toBe('advantage');
      expect(paralyzed.incomingMeleeAttacks).toBe('crit-on-hit');
    });

    it('should define unconscious mechanics correctly', () => {
      const unconscious = CONDITION_MECHANICS.unconscious;

      expect(unconscious.incapacitated).toBe(true);
      expect(unconscious.cannotMoveOrSpeak).toBe(true);
      expect(unconscious.speedZero).toBe(true);
      expect(unconscious.autoFailSaves).toEqual(['STR', 'DEX']);
      expect(unconscious.incomingAttacks).toBe('advantage');
      expect(unconscious.incomingMeleeAttacks).toBe('crit-on-hit');
      expect(unconscious.dropsItems).toBe(true);
      expect(unconscious.fallsProne).toBe(true);
    });
  });

  describe('applyConditionsToRoll', () => {
    describe('Attacker conditions', () => {
      it('should apply disadvantage on attacks when prone', () => {
        const context = createRollContext('attack');
        const conditions: ActiveCondition[] = [
          { condition: 'prone', source: 'trip-attack', duration: 0 },
        ];

        const result = applyConditionsToRoll(context, conditions, false);

        expect(result.disadvantageSources).toHaveLength(1);
        expect(result.disadvantageSources[0].source).toBe('prone');
      });

      it('should apply advantage on attacks when invisible', () => {
        const context = createRollContext('attack');
        const conditions: ActiveCondition[] = [
          { condition: 'invisible', source: 'spell', duration: 0 },
        ];

        const result = applyConditionsToRoll(context, conditions, false);

        expect(result.advantageSources).toHaveLength(1);
        expect(result.advantageSources[0].source).toBe('invisible');
      });

      it('should apply disadvantage on attacks when poisoned', () => {
        const context = createRollContext('attack');
        const conditions: ActiveCondition[] = [
          { condition: 'poisoned', source: 'poison-attack', duration: 0 },
        ];

        const result = applyConditionsToRoll(context, conditions, false);

        expect(result.disadvantageSources).toHaveLength(1);
        expect(result.disadvantageSources[0].source).toBe('poisoned');
      });

      it('should apply disadvantage on ability checks when frightened', () => {
        const context = createRollContext('check');
        const conditions: ActiveCondition[] = [
          { condition: 'frightened', source: 'fear-spell', duration: 0 },
        ];

        const result = applyConditionsToRoll(context, conditions, false);

        expect(result.disadvantageSources).toHaveLength(1);
        expect(result.disadvantageSources[0].source).toBe('frightened');
      });

      it('should apply disadvantage on saving throws when restrained', () => {
        const context = createRollContext('save');
        const conditions: ActiveCondition[] = [
          { condition: 'restrained', source: 'grapple', duration: 0 },
        ];

        const result = applyConditionsToRoll(context, conditions, false);

        expect(result.disadvantageSources).toHaveLength(1);
        expect(result.disadvantageSources[0].source).toBe('restrained');
      });

      it('should handle multiple conditions stacking', () => {
        const context = createRollContext('attack');
        const conditions: ActiveCondition[] = [
          { condition: 'prone', duration: 'instant' },
          { condition: 'poisoned', source: 'poison-attack', duration: 0 },
        ];

        const result = applyConditionsToRoll(context, conditions, false);

        expect(result.disadvantageSources).toHaveLength(2);
      });
    });

    describe('Defender conditions', () => {
      it('should grant advantage to attacker when target is prone (melee)', () => {
        const context = createRollContext('attack');
        const conditions: ActiveCondition[] = [
          { condition: 'prone', duration: 'instant' },
        ];

        const result = applyConditionsToRoll(context, conditions, true);

        expect(result.advantageSources).toHaveLength(1);
        expect(result.advantageSources[0].source).toBe('target-prone-melee');
      });

      it('should grant advantage to attacker when target is restrained', () => {
        const context = createRollContext('attack');
        const conditions: ActiveCondition[] = [
          { condition: 'restrained', source: 'grapple', duration: 0 },
        ];

        const result = applyConditionsToRoll(context, conditions, true);

        expect(result.advantageSources).toHaveLength(1);
        expect(result.advantageSources[0].source).toBe('target-restrained');
      });

      it('should grant disadvantage to attacker when target is invisible', () => {
        const context = createRollContext('attack');
        const conditions: ActiveCondition[] = [
          { condition: 'invisible', source: 'spell', duration: 0 },
        ];

        const result = applyConditionsToRoll(context, conditions, true);

        expect(result.disadvantageSources).toHaveLength(1);
        expect(result.disadvantageSources[0].source).toBe('target-invisible');
      });

      it('should grant advantage when target is stunned', () => {
        const context = createRollContext('attack');
        const conditions: ActiveCondition[] = [
          { condition: 'stunned', source: 'stunning-strike', duration: 0 },
        ];

        const result = applyConditionsToRoll(context, conditions, true);

        expect(result.advantageSources).toHaveLength(1);
        expect(result.advantageSources[0].source).toBe('target-stunned');
      });
    });

    describe('Unknown conditions', () => {
      it('should skip unknown conditions without error', () => {
        const context = createRollContext('attack');
        const conditions: ActiveCondition[] = [
          { condition: 'unknown-condition', source: 'test', duration: 0 } as ActiveCondition,
        ];

        const result = applyConditionsToRoll(context, conditions, false);

        expect(result.advantageSources).toHaveLength(0);
        expect(result.disadvantageSources).toHaveLength(0);
      });
    });
  });

  describe('checkAutoFailSave', () => {
    it('should return true for STR save when stunned', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'stunned', source: 'stunning-strike', duration: 0 },
      ];

      expect(checkAutoFailSave(conditions, 'STR')).toBe(true);
    });

    it('should return true for DEX save when stunned', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'stunned', source: 'stunning-strike', duration: 0 },
      ];

      expect(checkAutoFailSave(conditions, 'DEX')).toBe(true);
    });

    it('should return false for CON save when stunned', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'stunned', source: 'stunning-strike', duration: 0 },
      ];

      expect(checkAutoFailSave(conditions, 'CON')).toBe(false);
    });

    it('should return true for STR save when paralyzed', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'paralyzed', source: 'hold-person', duration: 0 },
      ];

      expect(checkAutoFailSave(conditions, 'STR')).toBe(true);
      expect(checkAutoFailSave(conditions, 'DEX')).toBe(true);
    });

    it('should return true for DEX save when unconscious', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'unconscious', source: 'sleep-spell', duration: 0 },
      ];

      expect(checkAutoFailSave(conditions, 'STR')).toBe(true);
      expect(checkAutoFailSave(conditions, 'DEX')).toBe(true);
    });

    it('should return false when no relevant conditions', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'poisoned', source: 'poison-attack', duration: 0 },
      ];

      expect(checkAutoFailSave(conditions, 'STR')).toBe(false);
      expect(checkAutoFailSave(conditions, 'DEX')).toBe(false);
      expect(checkAutoFailSave(conditions, 'CON')).toBe(false);
    });

    it('should handle multiple conditions', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'poisoned', source: 'poison-attack', duration: 0 },
        { condition: 'stunned', source: 'stunning-strike', duration: 0 },
      ];

      expect(checkAutoFailSave(conditions, 'STR')).toBe(true);
    });

    it('should handle empty conditions array', () => {
      expect(checkAutoFailSave([], 'STR')).toBe(false);
    });
  });

  describe('isIncapacitated', () => {
    it('should return true when stunned', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'stunned', source: 'stunning-strike', duration: 0 },
      ];

      expect(isIncapacitated(conditions)).toBe(true);
    });

    it('should return true when paralyzed', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'paralyzed', source: 'hold-person', duration: 0 },
      ];

      expect(isIncapacitated(conditions)).toBe(true);
    });

    it('should return true when unconscious', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'unconscious', source: 'sleep-spell', duration: 0 },
      ];

      expect(isIncapacitated(conditions)).toBe(true);
    });

    it('should return true when petrified', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'petrified', source: 'basilisk', duration: 0 },
      ];

      expect(isIncapacitated(conditions)).toBe(true);
    });

    it('should return false when only poisoned', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'poisoned', source: 'poison-attack', duration: 0 },
      ];

      expect(isIncapacitated(conditions)).toBe(false);
    });

    it('should return false when only prone', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'prone', duration: 'instant' },
      ];

      expect(isIncapacitated(conditions)).toBe(false);
    });

    it('should return false for empty conditions', () => {
      expect(isIncapacitated([])).toBe(false);
    });

    it('should return true if any condition causes incapacitation', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'poisoned', source: 'poison-attack', duration: 0 },
        { condition: 'prone', duration: 'instant' },
        { condition: 'stunned', source: 'stunning-strike', duration: 0 },
      ];

      expect(isIncapacitated(conditions)).toBe(true);
    });
  });

  describe('checkAutoCrit', () => {
    it('should return true for melee attacks against paralyzed target', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'paralyzed', source: 'hold-person', duration: 0 },
      ];

      expect(checkAutoCrit(conditions, true)).toBe(true);
    });

    it('should return true for melee attacks against unconscious target', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'unconscious', source: 'sleep-spell', duration: 0 },
      ];

      expect(checkAutoCrit(conditions, true)).toBe(true);
    });

    it('should return false for ranged attacks against paralyzed target', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'paralyzed', source: 'hold-person', duration: 0 },
      ];

      expect(checkAutoCrit(conditions, false)).toBe(false);
    });

    it('should return false for ranged attacks against unconscious target', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'unconscious', source: 'sleep-spell', duration: 0 },
      ];

      expect(checkAutoCrit(conditions, false)).toBe(false);
    });

    it('should return false for melee attacks against prone target', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'prone', duration: 'instant' },
      ];

      expect(checkAutoCrit(conditions, true)).toBe(false);
    });

    it('should return false for melee attacks against stunned target', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'stunned', source: 'stunning-strike', duration: 0 },
      ];

      expect(checkAutoCrit(conditions, true)).toBe(false);
    });

    it('should return false when no conditions', () => {
      expect(checkAutoCrit([], true)).toBe(false);
    });

    it('should return true if any condition grants auto-crit', () => {
      const conditions: ActiveCondition[] = [
        { condition: 'poisoned', source: 'poison-attack', duration: 0 },
        { condition: 'paralyzed', source: 'hold-person', duration: 0 },
      ];

      expect(checkAutoCrit(conditions, true)).toBe(true);
    });
  });

  describe('Edge cases and interactions', () => {
    it('should handle condition with custom duration', () => {
      const context = createRollContext('attack');
      const conditions: ActiveCondition[] = [
        {
          condition: 'poisoned',
          source: 'enemy-1',
          duration: 1,
          saveDC: 15,
          saveAbility: 'CON',
        },
      ];

      const result = applyConditionsToRoll(context, conditions, false);

      expect(result.disadvantageSources).toHaveLength(1);
    });

    it('should handle same condition multiple times', () => {
      const context = createRollContext('attack');
      const conditions: ActiveCondition[] = [
        { condition: 'poisoned', source: 'poison-attack', duration: 0 },
        { condition: 'poisoned', source: 'poison-attack', duration: 0 },
      ];

      const result = applyConditionsToRoll(context, conditions, false);

      // Should apply disadvantage for each instance
      expect(result.disadvantageSources).toHaveLength(2);
    });

    it('should preserve context bonuses when applying conditions', () => {
      const context = createRollContext('attack', [5]);
      const conditions: ActiveCondition[] = [
        { condition: 'poisoned', source: 'poison-attack', duration: 0 },
      ];

      const result = applyConditionsToRoll(context, conditions, false);

      expect(result.bonuses).toEqual([5]);
    });

    it('should not affect non-roll contexts', () => {
      const context = createRollContext('initiative');
      const conditions: ActiveCondition[] = [
        { condition: 'poisoned', source: 'poison-attack', duration: 0 },
      ];

      const result = applyConditionsToRoll(context, conditions, false);

      // Poisoned doesn't affect initiative
      expect(result.disadvantageSources).toHaveLength(0);
    });
  });
});
