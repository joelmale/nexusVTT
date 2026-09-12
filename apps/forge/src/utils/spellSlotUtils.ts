/**
 * Spell Slot Normalization Utilities
 *
 * The raw spell slot data mixes conventions:
 * - Most classes store cantrips known at index 0, with spell levels starting at index 1.
 * - Bard data stores 1st-level slots at index 0 (no cantrip placeholder).
 *
 * To make downstream logic consistent, we normalize everything to:
 *   index 0: placeholder for cantrips (always 0 in normalized array)
 *   index 1: 1st-level slots, index 2: 2nd-level slots, etc.
 * The normalized array is always length 10 (0..9) to cover up to 9th-level slots.
 */

const ZERO_BASED_SLOT_CLASSES = new Set(['bard']);

/**
 * Normalize a raw spell slot array to the cantrip-placeholder convention.
 */
export function normalizeSpellSlots(classSlug: string, rawSlots: number[] = []): number[] {
  const padded = [...rawSlots];
  // Ensure we have room for levels 0-9
  while (padded.length < 10) {
    padded.push(0);
  }

  // Bard data stores 1st-level at index 0, so shift everything right.
  if (ZERO_BASED_SLOT_CLASSES.has(classSlug)) {
    return [0, ...padded].slice(0, 10);
  }

  // Default: index 0 is cantrips known, shift it out.
  return [0, ...padded.slice(1, 10)];
}

/**
 * Determine the highest spell level with at least one available slot.
 */
export function getHighestSpellSlotLevel(classSlug: string, rawSlots: number[] = []): number {
  const normalized = normalizeSpellSlots(classSlug, rawSlots);
  for (let level = normalized.length - 1; level > 0; level -= 1) {
    if (normalized[level] > 0) {
      return level;
    }
  }
  return 0;
}
