import { describe, expect, it } from 'vitest';
import {
  calculateItemsWealth,
  evaluatePartyWealth,
  getExpectedWealthRange,
  getPartyAverageLevel,
  resolvePartyLevels,
} from './wealthTracker';
import type { CampaignItem, PlayerCharacter } from '../../demo/fixture-registry/types';

describe('wealthTracker', () => {
  describe('calculateItemsWealth', () => {
    it('sums values multiplying by quantities', () => {
      const items: CampaignItem[] = [
        {
          id: 'i1',
          campaignId: 'c',
          name: 'Potion of Healing',
          type: 'potion',
          rarity: 'common',
          valueGp: 50,
          quantity: 3,
        },
        {
          id: 'i2',
          campaignId: 'c',
          name: 'Bag of Holding',
          type: 'wondrous',
          rarity: 'uncommon',
          valueGp: 400,
          quantity: 1,
        },
        {
          id: 'i3',
          campaignId: 'c',
          name: 'Mystery Orb',
          type: 'wondrous',
          rarity: 'rare',
        },
      ];

      expect(calculateItemsWealth(items)).toBe(50 * 3 + 400 + 0);
    });

    it('returns 0 for empty items array', () => {
      expect(calculateItemsWealth([])).toBe(0);
    });
  });

  describe('resolvePartyLevels and getPartyAverageLevel', () => {
    it('uses player characters levels when present', () => {
      const pcs: PlayerCharacter[] = [
        { id: 'p1', name: 'Althea', ancestry: 'Elf', className: 'Wizard', level: 3, hook: '' },
        { id: 'p2', name: 'Brog', ancestry: 'Dwarf', className: 'Fighter', level: 5, hook: '' },
      ];
      expect(resolvePartyLevels(pcs, 9)).toEqual([3, 5]);
      expect(getPartyAverageLevel(pcs, 9)).toBe(4);
    });

    it('falls back to session partyLevel for 4 members when pcs is empty', () => {
      expect(resolvePartyLevels([], 7)).toEqual([7, 7, 7, 7]);
      expect(getPartyAverageLevel([], 7)).toBe(7);
    });

    it('falls back to [1, 1, 1, 1] when pcs is empty and session partyLevel is missing', () => {
      expect(resolvePartyLevels([], undefined)).toEqual([1, 1, 1, 1]);
      expect(getPartyAverageLevel([], undefined)).toBe(1);
      expect(resolvePartyLevels(undefined, 0)).toEqual([1, 1, 1, 1]);
      expect(getPartyAverageLevel([], 0)).toBe(1);
    });
  });

  describe('getExpectedWealthRange', () => {
    it('calculates expected wealth range scaling with party size', () => {
      const range = getExpectedWealthRange(4, 5);
      expect(range.tier).toBe(2);
      expect(range.minGp).toBe(800 * 4);
      expect(range.maxGp).toBe(2500 * 4);
    });

    it('clamps levels between 1 and 20', () => {
      const low = getExpectedWealthRange(4, 0);
      expect(low.tier).toBe(1);

      const high = getExpectedWealthRange(4, 25);
      expect(high.tier).toBe(4);
    });
  });

  describe('evaluatePartyWealth', () => {
    it('evaluates status as expected when in range', () => {
      const evaluation = evaluatePartyWealth(5000, 4, 5);
      expect(evaluation.status).toBe('expected');
      expect(evaluation.label).toContain('On track for Tier 2');
    });

    it('evaluates status as below when under min range', () => {
      const evaluation = evaluatePartyWealth(500, 4, 5);
      expect(evaluation.status).toBe('below');
      expect(evaluation.label).toContain('Below Tier 2');
    });

    it('evaluates status as above when exceeding max range', () => {
      const evaluation = evaluatePartyWealth(25000, 4, 5);
      expect(evaluation.status).toBe('above');
      expect(evaluation.label).toContain('Abundant for Tier 2');
    });
  });
});
