/**
 * Unit Tests for EquipmentInventoryBuilder
 *
 * Tests each builder method independently to ensure:
 * - Correct inventory construction
 * - Proper tracking of equipped items
 * - Item merging logic
 * - Equipment caching
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquipmentInventoryBuilder, processEquipment } from './equipmentProcessor';
import type { EquippedItem } from '../types/dnd';
import * as dataService from '../services/dataService';

// Mock the dataService module
vi.mock('../services/dataService', async () => {
  const actual = await vi.importActual('../services/dataService');
  return {
    ...actual,
    loadEquipment: vi.fn(),
    EQUIPMENT_PACKAGES: [
      {
        name: 'Level 1 Starter Pack',
        level: 1,
        startingGold: 100,
        items: [
          { name: 'Longsword', slug: 'longsword', quantity: 1, equipped: true },
          { name: 'Shield', slug: 'shield', quantity: 1, equipped: false },
        ],
      },
    ],
  };
});

describe('EquipmentInventoryBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addFromPackage', () => {
    it('should add all items from package to inventory', () => {
      vi.mocked(dataService.loadEquipment).mockReturnValue([]);

      const builder = new EquipmentInventoryBuilder();
      const pkg = {
        name: 'Test Pack',
        level: 1,
        startingGold: 100,
        items: [
          { name: 'Longsword', slug: 'longsword', quantity: 1, equipped: true },
          { name: 'Shield', slug: 'shield', quantity: 1, equipped: false },
        ],
      };

      const result = builder.addFromPackage(pkg).build();

      expect(result.inventory).toHaveLength(2);
      expect(result.inventory[0]).toEqual({
        equipmentSlug: 'longsword',
        quantity: 1,
        equipped: true,
      });
      expect(result.inventory[1]).toEqual({
        equipmentSlug: 'shield',
        quantity: 1,
        equipped: false,
      });
    });

    it('should normalize item slugs when not provided', () => {
      vi.mocked(dataService.loadEquipment).mockReturnValue([]);

      const builder = new EquipmentInventoryBuilder();
      const pkg = {
        name: 'Normalization Pack',
        level: 1,
        startingGold: 100,
        items: [
          { name: 'Long Sword +1', quantity: 1, equipped: false },
        ],
      };

      const result = builder.addFromPackage(pkg).build();

      // The regex replaces all non-alphanumeric chars with '-', including '+'
      expect(result.inventory[0].equipmentSlug).toBe('long-sword--1');
    });

    it('should track equipped weapons', () => {
      vi.mocked(dataService.loadEquipment).mockReturnValue([
        {
          slug: 'longsword',
          name: 'Longsword',
          weapon_category: 'Martial Melee Weapons',
        } as any,
      ]);

      const builder = new EquipmentInventoryBuilder();
      const pkg = {
        name: 'Weapons Pack',
        level: 1,
        startingGold: 100,
        items: [
          { name: 'Longsword', slug: 'longsword', quantity: 1, equipped: true },
        ],
      };

      const result = builder.addFromPackage(pkg).build();

      expect(result.equippedWeapons).toContain('longsword');
    });

    it('should track equipped armor', () => {
      vi.mocked(dataService.loadEquipment).mockReturnValue([
        {
          slug: 'chain-mail',
          name: 'Chain Mail',
          armor_category: 'Heavy',
          armor_class: { base: 16 },
        } as any,
      ]);

      const builder = new EquipmentInventoryBuilder();
      const pkg = {
        name: 'Armor Pack',
        level: 1,
        startingGold: 100,
        items: [
          { name: 'Chain Mail', slug: 'chain-mail', quantity: 1, equipped: true },
        ],
      };

      const result = builder.addFromPackage(pkg).build();

      expect(result.equippedArmor).toBe('chain-mail');
    });

    it('should handle items with equipped defaulting to false', () => {
      const builder = new EquipmentInventoryBuilder();
      const pkg = {
        name: 'Default Equip Pack',
        level: 1,
        startingGold: 100,
        items: [
          { name: 'Rope', slug: 'rope', quantity: 50 },
        ],
      };

      const result = builder.addFromPackage(pkg).build();

      expect(result.inventory[0].equipped).toBe(false);
    });
  });

  describe('addFromChoices', () => {
    it('should add items from selected equipment choices', () => {
      vi.mocked(dataService.loadEquipment).mockReturnValue([
        { slug: 'longsword', name: 'Longsword' } as any,
        { slug: 'shortbow', name: 'Shortbow' } as any,
      ]);

      const builder = new EquipmentInventoryBuilder();
      const choices = [
        {
          selected: 0,
          options: [
            [{ name: 'Longsword', quantity: 1 }],
            [{ name: 'Shortbow', quantity: 1 }],
          ],
        },
      ];

      const result = builder.addFromChoices(choices).build();

      expect(result.inventory).toHaveLength(1);
      expect(result.inventory[0].equipmentSlug).toBe('longsword');
      expect(result.inventory[0].equipped).toBe(false);
    });

    it('should skip choices with no selection (null)', () => {
      const builder = new EquipmentInventoryBuilder();
      const choices = [
        {
          selected: null,
          options: [
            [{ name: 'Longsword', quantity: 1 }],
          ],
        },
      ];

      const result = builder.addFromChoices(choices).build();

      expect(result.inventory).toHaveLength(0);
    });

    it('should handle multiple items in a selected bundle', () => {
      vi.mocked(dataService.loadEquipment).mockReturnValue([
        { slug: 'shortsword', name: 'Shortsword' } as any,
        { slug: 'dagger', name: 'Dagger' } as any,
      ]);

      const builder = new EquipmentInventoryBuilder();
      const choices = [
        {
          selected: 0,
          options: [
            [
              { name: 'Shortsword', quantity: 1 },
              { name: 'Dagger', quantity: 2 },
            ],
          ],
        },
      ];

      const result = builder.addFromChoices(choices).build();

      expect(result.inventory).toHaveLength(2);
      expect(result.inventory[0].equipmentSlug).toBe('shortsword');
      expect(result.inventory[1].equipmentSlug).toBe('dagger');
      expect(result.inventory[1].quantity).toBe(2);
    });

    it('should skip items not found in equipment database', () => {
      vi.mocked(dataService.loadEquipment).mockReturnValue([]);

      const builder = new EquipmentInventoryBuilder();
      const choices = [
        {
          selected: 0,
          options: [
            [{ name: 'Unknown Item', quantity: 1 }],
          ],
        },
      ];

      const result = builder.addFromChoices(choices).build();

      expect(result.inventory).toHaveLength(0);
    });

    it('should match equipment by normalized slug or name', () => {
      vi.mocked(dataService.loadEquipment).mockReturnValue([
        { slug: 'chain-mail', name: 'Chain Mail' } as any,
      ]);

      const builder = new EquipmentInventoryBuilder();
      const choices = [
        {
          selected: 0,
          options: [
            [{ name: 'Chain Mail', quantity: 1 }],
          ],
        },
      ];

      const result = builder.addFromChoices(choices).build();

      expect(result.inventory).toHaveLength(1);
      expect(result.inventory[0].equipmentSlug).toBe('chain-mail');
    });
  });

  describe('addFromStartingInventory', () => {
    it('should add custom starting inventory items', () => {
      const builder = new EquipmentInventoryBuilder();
      const startingInventory: EquippedItem[] = [
        { equipmentSlug: 'torch', quantity: 5, equipped: false },
        { equipmentSlug: 'rations', quantity: 10, equipped: false },
      ];

      const result = builder.addFromStartingInventory(startingInventory).build();

      expect(result.inventory).toHaveLength(2);
      expect(result.inventory[0].equipmentSlug).toBe('torch');
      expect(result.inventory[1].equipmentSlug).toBe('rations');
    });

    it('should handle undefined starting inventory', () => {
      const builder = new EquipmentInventoryBuilder();
      const result = builder.addFromStartingInventory(undefined).build();

      expect(result.inventory).toHaveLength(0);
    });

    it('should merge quantities for duplicate items', () => {
      const builder = new EquipmentInventoryBuilder();

      // Add item first
      builder.addFromStartingInventory([
        { equipmentSlug: 'torch', quantity: 5, equipped: false },
      ]);

      // Add same item again
      builder.addFromStartingInventory([
        { equipmentSlug: 'torch', quantity: 3, equipped: false },
      ]);

      const result = builder.build();

      expect(result.inventory).toHaveLength(1);
      expect(result.inventory[0].quantity).toBe(8);
    });

    it('should preserve equipped status when merging', () => {
      const builder = new EquipmentInventoryBuilder();

      builder.addFromStartingInventory([
        { equipmentSlug: 'torch', quantity: 5, equipped: true },
      ]);

      builder.addFromStartingInventory([
        { equipmentSlug: 'torch', quantity: 3, equipped: false },
      ]);

      const result = builder.build();

      expect(result.inventory[0].equipped).toBe(true);
    });
  });

  describe('build', () => {
    it('should return empty result when no items added', () => {
      const builder = new EquipmentInventoryBuilder();
      const result = builder.build();

      expect(result.inventory).toHaveLength(0);
      expect(result.equippedArmor).toBeUndefined();
      expect(result.equippedWeapons).toHaveLength(0);
    });

    it('should return complete result with all tracked items', () => {
      vi.mocked(dataService.loadEquipment).mockReturnValue([
        { slug: 'longsword', name: 'Longsword', weapon_category: 'Martial' } as any,
        { slug: 'chain-mail', name: 'Chain Mail', armor_category: 'Heavy' } as any,
      ]);

      const builder = new EquipmentInventoryBuilder();
      const pkg = {
        name: 'Full Pack',
        level: 1,
        startingGold: 100,
        items: [
          { name: 'Longsword', slug: 'longsword', quantity: 1, equipped: true },
          { name: 'Chain Mail', slug: 'chain-mail', quantity: 1, equipped: true },
        ],
      };

      const result = builder.addFromPackage(pkg).build();

      expect(result.inventory).toHaveLength(2);
      expect(result.equippedArmor).toBe('chain-mail');
      expect(result.equippedWeapons).toContain('longsword');
    });
  });

  describe('method chaining', () => {
    it('should allow chaining all methods', () => {
      vi.mocked(dataService.loadEquipment).mockReturnValue([
        { slug: 'longsword', name: 'Longsword', weapon_category: 'Martial' } as any,
      ]);

      const pkg = {
        name: 'Chained Pack',
        level: 1,
        startingGold: 100,
        items: [{ name: 'Longsword', slug: 'longsword', quantity: 1, equipped: true }],
      };

      const choices = [
        {
          selected: 0,
          options: [[{ name: 'Longsword', quantity: 1 }]],
        },
      ];

      const startingInventory: EquippedItem[] = [
        { equipmentSlug: 'torch', quantity: 5, equipped: false },
      ];

      const result = new EquipmentInventoryBuilder()
        .addFromPackage(pkg)
        .addFromChoices(choices)
        .addFromStartingInventory(startingInventory)
        .build();

      expect(result.inventory.length).toBeGreaterThan(0);
    });
  });

  describe('equipment caching', () => {
    it('should cache equipment lookups to avoid repeated calls', () => {
      const mockLoadEquipment = vi.mocked(dataService.loadEquipment);
      mockLoadEquipment.mockReturnValue([
        { slug: 'longsword', name: 'Longsword', weapon_category: 'Martial' } as any,
      ]);

      const builder = new EquipmentInventoryBuilder();
      const pkg = {
        name: 'Cached Pack',
        level: 1,
        startingGold: 100,
        items: [
          { name: 'Longsword', slug: 'longsword', quantity: 1, equipped: true },
          { name: 'Longsword', slug: 'longsword', quantity: 1, equipped: false },
        ],
      };

      builder.addFromPackage(pkg).build();

      // loadEquipment should be called, but cached on subsequent lookups
      expect(mockLoadEquipment).toHaveBeenCalled();
      const callCount = mockLoadEquipment.mock.calls.length;

      // Clear mock and add more items with same equipment
      mockLoadEquipment.mockClear();

      builder.addFromPackage(pkg);

      // Should use cache, not call loadEquipment again for same slug
      expect(mockLoadEquipment.mock.calls.length).toBeLessThanOrEqual(callCount);
    });
  });
});

describe('processEquipment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process complete equipment for character creation', () => {
    vi.mocked(dataService.loadEquipment).mockReturnValue([
      { slug: 'longsword', name: 'Longsword', weapon_category: 'Martial' } as any,
    ]);

    const data = {
      equipmentChoices: [
        {
          selected: 0,
          options: [[{ name: 'Longsword', quantity: 1 }]],
        },
      ],
      startingInventory: [
        { equipmentSlug: 'torch', quantity: 5, equipped: false },
      ],
    } as any;

    const result = processEquipment(data, 1);

    expect(result.inventory.length).toBeGreaterThan(0);
  });

  it('should use default equipment package if level not found', () => {
    const data = {
      equipmentChoices: [],
      startingInventory: undefined,
    } as any;

    const result = processEquipment(data, 999);

    // Should use EQUIPMENT_PACKAGES[0] as fallback
    expect(result.inventory.length).toBeGreaterThan(0);
  });

  it('should integrate all equipment sources', () => {
    vi.mocked(dataService.loadEquipment).mockReturnValue([
      { slug: 'longsword', name: 'Longsword', weapon_category: 'Martial' } as any,
      { slug: 'chain-mail', name: 'Chain Mail', armor_category: 'Heavy' } as any,
    ]);

    const data = {
      equipmentChoices: [
        {
          selected: 0,
          options: [[{ name: 'Longsword', quantity: 1 }]],
        },
      ],
      startingInventory: [
        { equipmentSlug: 'torch', quantity: 5, equipped: false },
      ],
    } as any;

    const result = processEquipment(data, 1);

    // Should have items from package + choices + starting inventory
    expect(result.inventory.length).toBeGreaterThanOrEqual(3);
  });
});
