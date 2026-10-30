import type { Equipment } from '../types/dnd';

/**
 * Stable comparison key for an item name. Case, punctuation, parenthetical
 * qualifiers and word order are ignored, so "Clothes, Traveler's" and
 * "Traveler's Clothes" collide, as do "Acid" and "Acid (vial)".
 */
export function equipmentNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/**
 * Collapse items sharing a name key. The first entry wins, except that an
 * entry with a slug replaces one without (the 2024 data has such a pair).
 */
function dedupeByName(items: Equipment[]): Map<string, Equipment> {
  const byKey = new Map<string, Equipment>();
  for (const item of items) {
    const key = equipmentNameKey(item.name);
    const existing = byKey.get(key);
    if (!existing || (!existing.slug && item.slug)) byKey.set(key, item);
  }
  return byKey;
}

/**
 * One combined catalog from the 2014 and 2024 SRD lists. 2024 entries win
 * over 2014 entries with the same name; what remains of the 2014 list is
 * 2014-only content and keeps `year: 2014` so the UI can tag it.
 */
export function mergeEquipmentCatalog(
  items2014: Equipment[],
  items2024: Equipment[],
): Equipment[] {
  const modern = dedupeByName(items2024);
  const legacy = dedupeByName(items2014);
  const only2014 = [...legacy].filter(([key]) => !modern.has(key));
  return [...modern.values(), ...only2014.map(([, item]) => item)];
}
