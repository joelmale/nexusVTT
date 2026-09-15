import { QuickStartItem, ShopItem } from '../types/equipment';
import { loadQuickStartEquipment, loadStartingWealthRules, loadNewPlayerShop, loadEquipment } from './dataService';
import { Equipment } from '../types/dnd';
import { log } from '../utils/logger';

/**
 * Generate quick start equipment for a character based on class and background
 */
export function generateQuickStartEquipment(
  classSlug: string,
  backgroundName: string
): {
  items: QuickStartItem[];
  currency: { gp: number; sp: number; cp: number };
} {
  const presets = loadQuickStartEquipment();

  // Get class preset (handle subclasses by using base class)
  const baseClassSlug = classSlug.split('-')[0];
  const classPreset = presets.classes[baseClassSlug] || presets.classes[classSlug];

  // Get background preset (normalize background name)
  const normalizedBgName = backgroundName.toLowerCase().replace(/\s+/g, '_').replace(/['"]/g, '');
  const backgroundPreset = presets.backgrounds[normalizedBgName];

  // Merge equipment from class and background
  const allItems = [
    ...(classPreset?.items || []),
    ...(backgroundPreset?.items || [])
  ];

  // Merge currency
  const currency = {
    gp: (classPreset?.currency?.gp || 0) + (backgroundPreset?.currency?.gp || 0),
    sp: (classPreset?.currency?.sp || 0) + (backgroundPreset?.currency?.sp || 0),
    cp: (classPreset?.currency?.cp || 0) + (backgroundPreset?.currency?.cp || 0)
  };

  return {
    items: mergeEquipmentItems(allItems),
    currency
  };
}

/**
 * Merge equipment items, combining duplicates by increasing quantity
 */
function mergeEquipmentItems(items: QuickStartItem[]): QuickStartItem[] {
  const merged = new Map<string, QuickStartItem>();

  for (const item of items) {
    const key = `${item.equipmentSlug}-${item.equipped ? 'equipped' : 'unequipped'}-${item.slot || 'none'}`;

    if (merged.has(key)) {
      const existing = merged.get(key)!;
      existing.quantity += item.quantity;
    } else {
      merged.set(key, { ...item });
    }
  }

  return Array.from(merged.values());
}

/**
 * Roll starting wealth for a character class
 */
export function rollStartingWealth(classSlug: string): number {
  const baseClassSlug = classSlug.split('-')[0];
  const rules = loadStartingWealthRules();
  const rule = rules.find(r => r.class_id === baseClassSlug);

  if (!rule) {
    log.warn('No wealth rule found for class; using default', { classSlug });
    return 100; // Default fallback
  }

  let total = 0;
  for (let i = 0; i < rule.dice_count; i++) {
    total += Math.floor(Math.random() * rule.dice_sides) + 1;
  }

  return total * rule.multiplier;
}

/**
 * Get average starting wealth for a character class (no rolling)
 */
export function getAverageStartingWealth(classSlug: string): number {
  const baseClassSlug = classSlug.split('-')[0];
  const rules = loadStartingWealthRules();
  const rule = rules.find(r => r.class_id === baseClassSlug);

  return rule?.average_gp || 100;
}

/**
 * Get shop item by ID
 */
export function getShopItem(itemId: string): ShopItem | undefined {
  const shop = loadNewPlayerShop();
  return shop.find(item => item.id === itemId);
}

/**
 * Validate if equipment slug exists in the database
 */
export function validateEquipmentSlug(slug: string): boolean {
  const equipment = loadEquipment();
  return equipment.some(eq => eq.slug === slug);
}

/**
 * Get equipment details by slug
 */
export function getEquipmentBySlug(slug: string): Equipment | undefined {
  const equipment = loadEquipment();
  return equipment.find(eq => eq.slug === slug);
}

/**
 * Calculate total cost of purchased items
 */
export function calculatePurchaseCost(items: { id: string; quantity: number }[]): number {
  const shop = loadNewPlayerShop();
  let total = 0;

  for (const purchase of items) {
    const item = shop.find(shopItem => shopItem.id === purchase.id);
    if (item) {
      total += item.cost_gp * purchase.quantity;
    }
  }

  return total;
}

/**
 * Check if character can afford purchase
 */
export function canAffordPurchase(
  startingGold: number,
  purchasedItems: { id: string; quantity: number }[]
): boolean {
  const cost = calculatePurchaseCost(purchasedItems);
  return startingGold >= cost;
}
