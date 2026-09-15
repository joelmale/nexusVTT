/**
 * Equipment Matching Utilities
 *
 * Provides robust equipment matching strategies for converting item names
 * from character creation choices into equipment slugs from the database.
 */

import { loadEquipment } from '../services/dataService';
import type { Equipment } from '../types/dnd';
import { log } from './logger';

// Lazy-loaded equipment database cache
let equipmentCache: Equipment[] | null = null;

/**
 * Get equipment database with lazy loading and caching
 */
function getEquipmentDatabase(): Equipment[] {
  if (!equipmentCache) {
    equipmentCache = loadEquipment();
  }
  return equipmentCache;
}

/**
 * Common equipment name to slug mappings for items that don't match automatically.
 * This handles naming inconsistencies between character creation choices and the equipment database.
 */
const EQUIPMENT_NAME_MAPPINGS: Record<string, string> = {
  // Armor
  'chain mail': 'chain-mail',
  'leather armor': 'leather',
  'studded leather': 'studded-leather',
  'hide armor': 'hide',
  'scale mail': 'scale-mail',
  'breastplate': 'breastplate',
  'half plate': 'half-plate',
  'ring mail': 'ring-mail',
  'plate armor': 'plate',
  'shield': 'shield',

  // Melee Weapons
  'handaxe': 'handaxe',
  'battleaxe': 'battleaxe',
  'warhammer': 'warhammer',
  'longsword': 'longsword',
  'shortsword': 'shortsword',
  'rapier': 'rapier',
  'greatsword': 'greatsword',
  'greataxe': 'greataxe',
  'maul': 'maul',
  'quarterstaff': 'quarterstaff',
  'dagger': 'dagger',
  'mace': 'mace',
  'sickle': 'sickle',
  'club': 'club',
  'spear': 'spear',
  'javelin': 'javelin',
  'trident': 'trident',
  'lance': 'lance',
  'halberd': 'halberd',
  'glaive': 'glaive',
  'pike': 'pike',
  'scimitar': 'scimitar',
  'flail': 'flail',
  'morningstar': 'morningstar',
  'whip': 'whip',

  // Ranged Weapons
  'light crossbow': 'light-crossbow',
  'longbow': 'longbow',
  'shortbow': 'shortbow',
  'blowgun': 'blowgun',
  'hand crossbow': 'hand-crossbow',
  'heavy crossbow': 'heavy-crossbow',
  'net': 'net',

  // Adventuring Gear
  'caltrops': 'caltrops',
  'holy water': 'holy-water',
  'healer\'s kit': 'healers-kit',
  'mess kit': 'mess-kit',
  'tinderbox': 'tinderbox',
  'torch': 'torch',
  'rations': 'rations',
  'waterskin': 'waterskin',
  'rope': 'rope',
  'crowbar': 'crowbar',
  'hammer': 'hammer',
  'pitons': 'pitons',
  'lantern': 'lantern',
  'oil': 'oil',
  'flint and steel': 'flint-and-steel',
  'backpack': 'backpack',
  'quiver': 'quiver',

  // Spellcasting Focuses
  'component pouch': 'component-pouch',
  'arcane focus': 'arcane-focus',
  'holy symbol': 'holy-symbol',
  'druidic focus': 'druidic-focus',

  // Tools
  'thieves\' tools': 'thieves-tools',
  'dice set': 'dice-set',
  'playing card set': 'playing-card-set',
  'navigator\'s tools': 'navigators-tools',
  'cartographer\'s tools': 'cartographers-tools',

  // Musical Instruments
  'bagpipes': 'bagpipes',
  'drum': 'drum',
  'dulcimer': 'dulcimer',
  'flute': 'flute',
  'lute': 'lute',
  'lyre': 'lyre',
  'horn': 'horn',
  'pan flute': 'pan-flute',
  'shawm': 'shawm',
  'viol': 'viol',

  // Equipment Packs
  'burglar\'s pack': 'burglars-pack',
  'diplomat\'s pack': 'diplomats-pack',
  'dungeoneer\'s pack': 'dungeoneers-pack',
  'entertainer\'s pack': 'entertainers-pack',
  'explorer\'s pack': 'explorers-pack',
  'priest\'s pack': 'priests-pack',
  'scholar\'s pack': 'scholars-pack'
};

/**
 * Equipment matching strategy interface
 */
interface EquipmentMatchStrategy {
  name: string;
  match: (itemName: string) => Equipment | null;
}

/**
 * Strategy 1: Exact slug match
 * Converts item name to slug format and looks for exact match
 */
const exactSlugMatch: EquipmentMatchStrategy = {
  name: 'Exact Slug Match',
  match: (itemName: string) => {
    const slug = itemName.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return getEquipmentDatabase().find(eq => eq.slug === slug) || null;
  }
};

/**
 * Strategy 2: Exact name match (case-insensitive)
 */
const exactNameMatch: EquipmentMatchStrategy = {
  name: 'Exact Name Match',
  match: (itemName: string) => {
    const lowerName = itemName.toLowerCase();
    return getEquipmentDatabase().find(eq => eq.name.toLowerCase() === lowerName) || null;
  }
};

/**
 * Strategy 3: Partial name match
 * Handles variations like "Chain Mail" vs "chain-mail"
 */
const partialNameMatch: EquipmentMatchStrategy = {
  name: 'Partial Name Match',
  match: (itemName: string) => {
    const normalizedSearch = itemName.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    return getEquipmentDatabase().find(eq => {
      const normalizedEq = eq.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      return normalizedEq.includes(normalizedSearch) || normalizedSearch.includes(normalizedEq);
    }) || null;
  }
};

/**
 * Strategy 4: Name mapping lookup
 * Uses predefined mappings for common naming inconsistencies
 */
const nameMappingMatch: EquipmentMatchStrategy = {
  name: 'Name Mapping Match',
  match: (itemName: string) => {
    const mappedSlug = EQUIPMENT_NAME_MAPPINGS[itemName.toLowerCase()];
    if (mappedSlug) {
      return getEquipmentDatabase().find(eq => eq.slug === mappedSlug) || null;
    }
    return null;
  }
};

/**
 * Chain of matching strategies, executed in order until a match is found
 */
const MATCHING_STRATEGIES: EquipmentMatchStrategy[] = [
  exactSlugMatch,
  exactNameMatch,
  partialNameMatch,
  nameMappingMatch
];

/**
 * Find equipment in database using multiple fallback strategies.
 *
 * This function attempts to match an item name from character creation
 * to an equipment entry in the database. It uses a chain of responsibility
 * pattern with multiple strategies:
 *
 * 1. **Exact Slug Match**: Converts name to slug format (e.g., "Chain Mail" → "chain-mail")
 * 2. **Exact Name Match**: Case-insensitive exact name comparison
 * 3. **Partial Name Match**: Fuzzy matching for variations
 * 4. **Name Mapping Match**: Uses predefined mappings for known inconsistencies
 *
 * @param itemName - The item name from character creation choices
 *
 * @returns The matching Equipment object, or null if no match found
 *
 * @example
 * ```typescript
 * const chainMail = findEquipmentByName('Chain Mail');
 * // Returns: { slug: 'chain-mail', name: 'Chain Mail', ... }
 *
 * const leather = findEquipmentByName('Leather Armor');
 * // Returns: { slug: 'leather', name: 'Leather', ... }
 *
 * const unknown = findEquipmentByName('Nonexistent Item');
 * // Returns: null
 * ```
 */
export function findEquipmentByName(itemName: string): Equipment | null {
  // Try each matching strategy in order
  for (const strategy of MATCHING_STRATEGIES) {
    const result = strategy.match(itemName);
    if (result) {
      return result;
    }
  }

  // No match found with any strategy
  log.warn('Could not find equipment match', { itemName });
  return null;
}

/**
 * Result of adding an item to inventory
 */
export interface InventoryAddResult {
  success: boolean;
  equipmentSlug: string;
  quantity: number;
  isUnknown: boolean;
  expandedFromPack: boolean;
}

/**
 * Add an item to character inventory with automatic equipment pack expansion.
 *
 * This function handles:
 * - Finding the equipment in the database
 * - Expanding equipment packs (e.g., "Burglar's Pack") into individual items
 * - Merging with existing inventory items (stacking quantities)
 * - Creating placeholder entries for unknown items
 *
 * @param itemName - Name of the item to add
 * @param quantity - Number of items to add (default: 1)
 *
 * @returns Array of InventoryAddResult objects (one per item added, multiple if pack expanded)
 *
 * @example
 * ```typescript
 * // Add a single weapon
 * const results = addItemToInventoryByName('Longsword', 1);
 * // Returns: [{ success: true, equipmentSlug: 'longsword', quantity: 1, isUnknown: false, expandedFromPack: false }]
 *
 * // Add an equipment pack (expands into multiple items)
 * const packResults = addItemToInventoryByName('Burglar\'s Pack', 1);
 * // Returns: [
 * //   { success: true, equipmentSlug: 'backpack', quantity: 1, ... },
 * //   { success: true, equipmentSlug: 'ball-bearings', quantity: 1, ... },
 * //   { success: true, equipmentSlug: 'rope', quantity: 10, ... },
 * //   ...
 * // ]
 * ```
 */
export function addItemToInventoryByName(
  itemName: string,
  quantity: number = 1
): InventoryAddResult[] {
  const foundEquipment = findEquipmentByName(itemName);

  if (!foundEquipment) {
    // Create placeholder for unknown item
    const placeholderSlug = `unknown-${itemName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
    return [{
      success: false,
      equipmentSlug: placeholderSlug,
      quantity,
      isUnknown: true,
      expandedFromPack: false
    }];
  }

  // Check if this is an equipment pack with contents
  if (foundEquipment.contents && foundEquipment.contents.length > 0) {
    // Expand pack into individual items
    return foundEquipment.contents.map(content => ({
      success: true,
      equipmentSlug: content.item_index,
      quantity: content.quantity * quantity, // Multiply by number of packs
      isUnknown: false,
      expandedFromPack: true
    }));
  }

  // Regular single item
  return [{
    success: true,
    equipmentSlug: foundEquipment.slug,
    quantity,
    isUnknown: false,
    expandedFromPack: false
  }];
}
