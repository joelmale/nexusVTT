import { describe, expect, it } from 'vitest';

import {
  highlightMatchedText,
  levenshteinDistance,
  parseItemQuery,
  searchItems,
  type SearchableItemLike,
} from './itemSearch';

describe('itemSearch', () => {
  describe('levenshteinDistance', () => {
    it('calculates edit distances correctly', () => {
      expect(levenshteinDistance('holding', 'holding')).toBe(0);
      expect(levenshteinDistance('holdin', 'holding')).toBe(1);
      expect(levenshteinDistance('hloding', 'holding')).toBe(2);
      expect(levenshteinDistance('', 'bag')).toBe(3);
    });
  });

  describe('parseItemQuery', () => {
    it('extracts operators and free text', () => {
      const parsed = parseItemQuery('bag hold rarity:rare type:wondrous attune gp<1000');
      expect(parsed.terms).toEqual(['bag', 'hold']);
      expect(parsed.freeText).toBe('bag hold');
      expect(parsed.rarity).toBe('rare');
      expect(parsed.itemType).toBe('wondrous');
      expect(parsed.requiresAttunement).toBe(true);
      expect(parsed.maxGp).toBe(1000);
      expect(parsed.minGp).toBeUndefined();
    });

    it('handles alternative gp and attune operators', () => {
      const parsed = parseItemQuery('gp>=500 !attune');
      expect(parsed.minGp).toBe(500);
      expect(parsed.requiresAttunement).toBe(false);
    });
  });

  describe('searchItems', () => {
    const mockItems: SearchableItemLike[] = [
      {
        id: '1',
        name: 'Bag of Holding',
        itemType: 'wondrous_item',
        rarity: 'uncommon',
        requiresAttunement: false,
        valueGp: 500,
        description: 'A magical bag that opens into an extradimensional space.',
      },
      {
        id: '2',
        name: 'Flame Tongue',
        itemType: 'weapon',
        rarity: 'rare',
        requiresAttunement: true,
        valueGp: 5000,
        description: 'A fiery sword that sheds bright light.',
      },
      {
        id: '3',
        name: 'Ring of Protection',
        itemType: 'ring',
        rarity: 'rare',
        requiresAttunement: true,
        valueGp: 3500,
        description: 'Grants +1 bonus to AC and saving throws.',
      },
      {
        id: '4',
        name: 'Healing Potion',
        itemType: 'potion',
        rarity: 'common',
        requiresAttunement: false,
        valueGp: 50,
        description: 'Restores hit points.',
      },
    ];

    it('matches word beginnings ("bag hold" finds "Bag of Holding")', () => {
      const results = searchItems(mockItems, 'bag hold');
      expect(results.length).toBe(1);
      expect(results[0].item.name).toBe('Bag of Holding');
    });

    it('ranks exact matches higher than substring/prefix matches', () => {
      const items: SearchableItemLike[] = [
        { id: '1', name: 'Ring', itemType: 'ring', rarity: 'common' },
        { id: '2', name: 'Ring of Protection', itemType: 'ring', rarity: 'rare' },
      ];
      const results = searchItems(items, 'ring');
      expect(results[0].item.name).toBe('Ring');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('tolerates one typo on words of 5+ letters', () => {
      // "potin" for "potion" has distance 1 and length >= 5
      const results = searchItems(mockItems, 'potin');
      expect(results.length).toBe(1);
      expect(results[0].item.name).toBe('Healing Potion');
    });

    it('filters strictly by operators', () => {
      // Rarity filter
      const rareResults = searchItems(mockItems, 'rarity:rare');
      expect(rareResults.map((r) => r.item.name)).toEqual(['Flame Tongue', 'Ring of Protection']);

      // GP operator
      const cheapResults = searchItems(mockItems, 'gp<600');
      expect(cheapResults.map((r) => r.item.name)).toEqual(['Bag of Holding', 'Healing Potion']);

      // Attunement operator
      const attuneResults = searchItems(mockItems, 'attune');
      expect(attuneResults.map((r) => r.item.name)).toEqual(['Flame Tongue', 'Ring of Protection']);

      // Combined query
      const combo = searchItems(mockItems, 'rarity:rare gp>4000');
      expect(combo.length).toBe(1);
      expect(combo[0].item.name).toBe('Flame Tongue');
    });

    it('returns all items when query is empty', () => {
      const results = searchItems(mockItems, '');
      expect(results.length).toBe(mockItems.length);
    });
  });

  describe('highlightMatchedText', () => {
    it('produces matched text segments', () => {
      const segments = highlightMatchedText('Bag of Holding', ['bag', 'hold']);
      expect(segments).toEqual([
        { text: 'Bag', match: true },
        { text: ' of ', match: false },
        { text: 'Hold', match: true },
        { text: 'ing', match: false },
      ]);
    });

    it('returns single unmatched segment when no terms match', () => {
      const segments = highlightMatchedText('Sword', ['shield']);
      expect(segments).toEqual([{ text: 'Sword', match: false }]);
    });
  });
});
