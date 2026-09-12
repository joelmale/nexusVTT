import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateQuickStartEquipment,
  rollStartingWealth,
  getAverageStartingWealth,
  calculatePurchaseCost,
  canAffordPurchase
} from '../services/equipmentService';
import { loadQuickStartEquipment, loadStartingWealthRules } from '../services/dataService';

// Mock the data service
vi.mock('../services/dataService', () => ({
  loadQuickStartEquipment: vi.fn(),
  loadStartingWealthRules: vi.fn(),
  loadNewPlayerShop: vi.fn(() => [
    { id: 'longsword', name: 'Longsword', cost_gp: 15, category: 'Weapon' as const },
    { id: 'shield', name: 'Shield', cost_gp: 10, category: 'Armor' as const, ac: 2 }
  ]),
  loadEquipment: vi.fn(() => []),
}));

describe('Equipment Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateQuickStartEquipment', () => {
    it('should generate equipment for valid class and background', () => {
      const mockPresets = {
        classes: {
          fighter: {
            label: 'Fighter Loadout',
            items: [
              { equipmentSlug: 'longsword', quantity: 1, equipped: true, slot: 'main_hand' as const }
            ]
          }
        },
        backgrounds: {
          soldier: {
            label: 'Soldier Kit',
            items: [
              { equipmentSlug: 'shield', quantity: 1, equipped: true, slot: 'off_hand' as const }
            ],
            currency: { gp: 10, sp: 0, cp: 0 }
          }
        }
      };

      vi.mocked(loadQuickStartEquipment).mockReturnValue(mockPresets);

      const result = generateQuickStartEquipment('fighter', 'soldier');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].equipmentSlug).toBe('longsword');
      expect(result.items[1].equipmentSlug).toBe('shield');
      expect(result.currency.gp).toBe(10);
    });

    it('should handle missing presets gracefully', () => {
      const mockPresets = { classes: {}, backgrounds: {} };
      vi.mocked(loadQuickStartEquipment).mockReturnValue(mockPresets);

      const result = generateQuickStartEquipment('unknown', 'unknown');

      expect(result.items).toEqual([]);
      expect(result.currency).toEqual({ gp: 0, sp: 0, cp: 0 });
    });

    it('should merge duplicate items by increasing quantity', () => {
      const mockPresets = {
        classes: {
          cleric: {
            label: 'Cleric Loadout',
            items: [
              { equipmentSlug: 'holy-symbol', quantity: 1, equipped: false }
            ]
          }
        },
        backgrounds: {
          acolyte: {
            label: 'Acolyte Kit',
            items: [
              { equipmentSlug: 'holy-symbol', quantity: 1, equipped: false }
            ],
            currency: { gp: 15, sp: 0, cp: 0 }
          }
        }
      };

      vi.mocked(loadQuickStartEquipment).mockReturnValue(mockPresets);

      const result = generateQuickStartEquipment('cleric', 'acolyte');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].equipmentSlug).toBe('holy-symbol');
      expect(result.items[0].quantity).toBe(2);
    });
  });

  describe('rollStartingWealth', () => {
    it('should roll wealth for valid class', () => {
      const mockRules = [
        { class_id: 'fighter', dice_count: 5, dice_sides: 4, multiplier: 10, average_gp: 125 }
      ];

      vi.mocked(loadStartingWealthRules).mockReturnValue(mockRules);

      // Mock Math.random to return 0.5 for predictable results
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = rollStartingWealth('fighter');

      // With dice_count=5, dice_sides=4, random=0.5:
      // Each die rolls (0.5 * 4) + 1 = 3
      // Total: 5 * 3 * 10 = 150
      expect(result).toBe(150);

      randomSpy.mockRestore();
    });

    it('should return fallback for unknown class', () => {
      vi.mocked(loadStartingWealthRules).mockReturnValue([]);

      const result = rollStartingWealth('unknown');

      expect(result).toBe(100); // Fallback value
    });
  });

  describe('getAverageStartingWealth', () => {
    it('should return average wealth for valid class', () => {
      const mockRules = [
        { class_id: 'wizard', dice_count: 4, dice_sides: 4, multiplier: 10, average_gp: 100 }
      ];

      vi.mocked(loadStartingWealthRules).mockReturnValue(mockRules);

      const result = getAverageStartingWealth('wizard');

      expect(result).toBe(100);
    });

    it('should return fallback for unknown class', () => {
      vi.mocked(loadStartingWealthRules).mockReturnValue([]);

      const result = getAverageStartingWealth('unknown');

      expect(result).toBe(100);
    });
  });

  describe('calculatePurchaseCost', () => {
    it('should calculate total cost of items', () => {
      const purchases = [
        { id: 'longsword', quantity: 1 },
        { id: 'shield', quantity: 2 }
      ];

      // Mock shop data
      const mockShopData = [
        { id: 'longsword', name: 'Longsword', cost_gp: 15 },
        { id: 'shield', name: 'Shield', cost_gp: 10 }
      ];

      vi.doMock('../data/newPlayerShop.json', () => mockShopData);

      const result = calculatePurchaseCost(purchases);

      expect(result).toBe(35); // 15 + (10 * 2)
    });

    it('should handle unknown items gracefully', () => {
      const purchases = [
        { id: 'unknown-item', quantity: 1 }
      ];

      const result = calculatePurchaseCost(purchases);

      expect(result).toBe(0);
    });
  });

  describe('canAffordPurchase', () => {
    it('should return true when affordable', () => {
      const purchases = [
        { id: 'dagger', quantity: 1 }
      ];

      const result = canAffordPurchase(10, purchases);

      expect(result).toBe(true);
    });

    it('should return false when over budget', () => {
      const purchases = [
        { id: 'longsword', quantity: 1 }
      ];

      const result = canAffordPurchase(10, purchases);

      expect(result).toBe(false);
    });
  });
});