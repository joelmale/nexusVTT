import { Equipment } from '../types/dnd';
import { loadEquipment } from '../services/dataService';

const EQUIPMENT_DATABASE: Equipment[] = loadEquipment();

/**
 * Filter equipment by search query, category, and edition
 */
export const filterEquipment = (
  equipment: Equipment[],
  filters: {
    searchQuery?: string;
    category?: string;
    year?: number | 'all';
  }
): Equipment[] => {
  return equipment.filter(eq => {
    // Search query filter
    const matchesSearch = !filters.searchQuery ||
      eq.name.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      eq.equipment_category.toLowerCase().includes(filters.searchQuery.toLowerCase());

    // Category filter
    const matchesCategory = !filters.category ||
      filters.category === 'All' ||
      eq.equipment_category === filters.category;

    // Year filter
    const matchesYear = !filters.year ||
      filters.year === 'all' ||
      eq.year === filters.year;

    return matchesSearch && matchesCategory && matchesYear;
  });
};

/**
 * Get unique equipment categories
 */
export const getEquipmentCategories = (equipment: Equipment[]): string[] => {
  const categories = new Set(equipment.map(eq => eq.equipment_category));
  return ['All', ...Array.from(categories).sort()];
};

/**
 * Get unique equipment editions/years
 */
export const getEquipmentYears = (equipment: Equipment[]): (number | 'all')[] => {
  const years = new Set(equipment.map(eq => eq.year));
  return ['all' as const, ...Array.from(years).sort()];
};

/**
 * Generate random additional equipment for character creation
 */
export const randomizeAdditionalEquipment = (count: number = 3): Array<{
  equipmentSlug: string;
  quantity: number;
  equipped: boolean;
}> => {
  const result: Array<{
    equipmentSlug: string;
    quantity: number;
    equipped: boolean;
  }> = [];

  // Filter to common adventuring gear (exclude very expensive or rare items)
  const commonGear = EQUIPMENT_DATABASE.filter(eq =>
    eq.cost.quantity <= 50 && // Under 50 gp
    !['Weapon', 'Armor'].includes(eq.equipment_category) && // Not weapons or armor
    eq.equipment_category !== 'Tools' // Not tools (usually class-specific)
  );

  // Randomly select items
  const shuffled = [...commonGear].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  selected.forEach(eq => {
    result.push({
      equipmentSlug: eq.slug,
      quantity: Math.random() > 0.7 ? 2 : 1, // 30% chance of getting 2
      equipped: false
    });
  });

  return result;
};

/**
 * Check if an item is already in the character's inventory
 */
export const isInInventory = (
  equipmentSlug: string,
  inventory: Array<{ equipmentSlug: string; quantity: number; equipped: boolean }>
): number => {
  return inventory
    .filter(item => item.equipmentSlug === equipmentSlug)
    .reduce((sum, item) => sum + item.quantity, 0);
};

/**
 * Add item to inventory (or increase quantity if already present)
 */
export const addToInventory = (
  equipmentSlug: string,
  inventory: Array<{ equipmentSlug: string; quantity: number; equipped: boolean }>
): Array<{ equipmentSlug: string; quantity: number; equipped: boolean }> => {
  const existingItem = inventory.find(item => item.equipmentSlug === equipmentSlug);

  if (existingItem) {
    return inventory.map(item =>
      item.equipmentSlug === equipmentSlug
        ? { ...item, quantity: item.quantity + 1 }
        : item
    );
  } else {
    return [...inventory, {
      equipmentSlug,
      quantity: 1,
      equipped: false
    }];
  }
};

/**
 * Remove item from inventory (or decrease quantity)
 */
export const removeFromInventory = (
  equipmentSlug: string,
  inventory: Array<{ equipmentSlug: string; quantity: number; equipped: boolean }>
): Array<{ equipmentSlug: string; quantity: number; equipped: boolean }> => {
  const existingItem = inventory.find(item => item.equipmentSlug === equipmentSlug);

  if (existingItem && existingItem.quantity > 1) {
    return inventory.map(item =>
      item.equipmentSlug === equipmentSlug
        ? { ...item, quantity: item.quantity - 1 }
        : item
    );
  } else {
    return inventory.filter(item => item.equipmentSlug !== equipmentSlug);
  }
};

/**
 * Get equipment by slug
 */
export const getEquipmentBySlug = (slug: string): Equipment | null => {
  return EQUIPMENT_DATABASE.find(eq => eq.slug === slug) || null;
};

/**
 * Format equipment cost for display
 */
export const formatEquipmentCost = (equipment: Equipment): string => {
  return `${equipment.cost.quantity} ${equipment.cost.unit}`;
};

/**
 * Format equipment weight for display
 */
export const formatEquipmentWeight = (equipment: Equipment): string => {
  return equipment.weight ? `${equipment.weight} lb` : '—';
};

/**
 * Get equipment display info (name, category, cost, weight, year)
 */
export const getEquipmentDisplayInfo = (equipment: Equipment): {
  name: string;
  category: string;
  cost: string;
  weight: string;
  year: string;
} => {
  return {
    name: equipment.name,
    category: equipment.equipment_category,
    cost: formatEquipmentCost(equipment),
    weight: formatEquipmentWeight(equipment),
    year: equipment.year === 2024 ? '2024' : '2014'
  };
};