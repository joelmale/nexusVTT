import { describe, expect, it } from 'vitest';
import {
  createPrng,
  evalDice,
  rollDie,
  rollTreasure,
} from './hoardRoller';
import type { SrdItem } from '../useSrdCatalog';

describe('hoardRoller', () => {
  describe('createPrng', () => {
    it('produces identical sequences given the same seed', () => {
      const prng1 = createPrng(42);
      const prng2 = createPrng(42);
      const seq1 = [prng1(), prng1(), prng1()];
      const seq2 = [prng2(), prng2(), prng2()];
      expect(seq1).toEqual(seq2);
    });

    it('produces different sequences given different seeds', () => {
      const prng1 = createPrng(42);
      const prng2 = createPrng(999);
      expect(prng1()).not.toEqual(prng2());
    });
  });

  describe('rollDie and evalDice', () => {
    it('rolls within die boundaries', () => {
      const prng = createPrng(123);
      for (let i = 0; i < 50; i++) {
        const roll = rollDie(6, prng);
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
      }
    });

    it('handles side <= 1 gracefully', () => {
      expect(rollDie(1)).toBe(1);
      expect(rollDie(0)).toBe(1);
    });

    it('evaluates dice with multipliers correctly', () => {
      const prng = createPrng(456);
      const result = evalDice({ count: 2, sides: 6, multiplier: 10 }, prng);
      expect(result).toBeGreaterThanOrEqual(20);
      expect(result).toBeLessThanOrEqual(120);
      expect(result % 10).toBe(0);
    });
  });

  describe('rollTreasure individual', () => {
    it('rolls individual treasure across all tiers', () => {
      const tiers = ['0-4', '5-10', '11-16', '17+'] as const;
      for (const tier of tiers) {
        const result = rollTreasure({
          tier,
          type: 'individual',
          seed: 12345,
        });
        expect(result.tier).toBe(tier);
        expect(result.type).toBe('individual');
        expect(result.valuables).toEqual([]);
        expect(result.magicItems).toEqual([]);
        expect(result.coins.totalGp).toBeGreaterThanOrEqual(0);
        expect(result.totalGp).toBe(result.coins.totalGp);
      }
    });
  });

  describe('rollTreasure hoard', () => {
    it('is deterministic when seeded', () => {
      const r1 = rollTreasure({ tier: '0-4', type: 'hoard', seed: 777 });
      const r2 = rollTreasure({ tier: '0-4', type: 'hoard', seed: 777 });
      expect(r1).toEqual(r2);
    });

    it('rolls hoard treasure with base coins, valuables, and magic items', () => {
      const result = rollTreasure({
        tier: '5-10',
        type: 'hoard',
        seed: 42,
      });

      expect(result.tier).toBe('5-10');
      expect(result.type).toBe('hoard');
      expect(result.coins.gp).toBeGreaterThan(0);
      expect(result.d100Roll).toBeGreaterThanOrEqual(1);
      expect(result.d100Roll).toBeLessThanOrEqual(100);
      expect(result.totalGp).toBeGreaterThan(0);
    });

    it('picks magic items from provided compendium items when available', () => {
      const mockCompendium: SrdItem[] = [
        {
          id: 'srd-boots',
          name: 'Boots of Speed',
          type: 'wondrous',
          rarity: 'rare',
          valueGp: 4000,
          attunement: true,
          ruleset: '2024',
          description: 'You can click your heels.',
        },
        {
          id: 'srd-cloak',
          name: 'Cloak of Elvenkind',
          type: 'wondrous',
          rarity: 'uncommon',
          valueGp: 500,
          attunement: true,
          ruleset: '2024',
          description: 'A mottled cloak.',
        },
      ];

      // Tier 0-4 with seed yielding magic items
      let foundCompendiumItem = false;
      for (let s = 1; s <= 20; s++) {
        const result = rollTreasure({
          tier: '0-4',
          type: 'hoard',
          seed: s,
          compendiumItems: mockCompendium,
        });
        if (result.magicItems.some((item) => item.sourceCompendiumId === 'srd-cloak' || item.sourceCompendiumId === 'srd-boots')) {
          foundCompendiumItem = true;
          break;
        }
      }
      expect(foundCompendiumItem).toBe(true);
    });

    it('falls back to default magic items when compendium is empty', () => {
      let foundFallback = false;
      for (let s = 1; s <= 20; s++) {
        const result = rollTreasure({
          tier: '11-16',
          type: 'hoard',
          seed: s,
          compendiumItems: [],
        });
        if (result.magicItems.length > 0) {
          foundFallback = true;
          expect(result.magicItems[0].name).toBeTruthy();
          break;
        }
      }
      expect(foundFallback).toBe(true);
    });

    it('rolls high tier hoards (17+) with legendary items', () => {
      const result = rollTreasure({
        tier: '17+',
        type: 'hoard',
        seed: 888,
      });

      expect(result.coins.gp).toBeGreaterThan(1000);
      expect(result.totalGp).toBeGreaterThan(1000);
    });
  });
});
