/**
 * D&D 5e Spell Slot and Multiclass Progression Engine.
 */

/**
 * Standard Full-Caster Spell Slot Matrix (Levels 1st - 9th slots per caster level 1..20).
 * Index corresponds to total effective caster level.
 */
export const FULL_CASTER_SLOTS: Record<number, Record<number, number>> = {
  1: { 1: 2 },
  2: { 1: 3 },
  3: { 1: 4, 2: 2 },
  4: { 1: 4, 2: 3 },
  5: { 1: 4, 2: 3, 3: 2 },
  6: { 1: 4, 2: 3, 3: 3 },
  7: { 1: 4, 2: 3, 3: 3, 4: 1 },
  8: { 1: 4, 2: 3, 3: 3, 4: 2 },
  9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
};

export interface ClassLevelEntry {
  classSlug: string;
  level: number;
}

const FULL_CASTER_CLASSES = new Set([
  'wizard',
  'cleric',
  'druid',
  'sorcerer',
  'bard',
]);

const HALF_CASTER_CLASSES = new Set(['paladin', 'ranger']);

const THIRD_CASTER_SUBCLASSES = new Set([
  'eldritch-knight',
  'arcane-trickster',
]);

/**
 * Calculates effective spellcaster level for multiclass characters.
 * Warlock Pact Magic is excluded from shared multiclass slot calculations.
 */
export function calculateMulticlassCasterLevel(
  classes: ClassLevelEntry[],
  edition: '2014' | '2024' = '2024',
): number {
  let effectiveLevel = 0;

  for (const entry of classes) {
    const slug = entry.classSlug.toLowerCase();
    const lvl = entry.level;

    if (FULL_CASTER_CLASSES.has(slug)) {
      effectiveLevel += lvl;
    } else if (HALF_CASTER_CLASSES.has(slug)) {
      // 2024 half casters round up (ceil(level / 2)), 2014 round down (floor(level / 2))
      if (edition === '2024') {
        effectiveLevel += Math.ceil(lvl / 2);
      } else {
        effectiveLevel += Math.floor(lvl / 2);
      }
    } else if (slug === 'artificer') {
      effectiveLevel += Math.ceil(lvl / 2);
    } else if (THIRD_CASTER_SUBCLASSES.has(slug)) {
      effectiveLevel += Math.floor(lvl / 3);
    }
  }

  return Math.min(20, effectiveLevel);
}

/**
 * Gets standard spell slots for a given total caster level.
 */
export function getSlotsForCasterLevel(
  casterLevel: number,
): Record<number, number> {
  const boundedLevel = Math.max(1, Math.min(20, casterLevel));
  return { ...(FULL_CASTER_SLOTS[boundedLevel] || {}) };
}

/**
 * Calculates Warlock Pact Magic slot count and slot level.
 */
export function getPactMagicSlots(warlockLevel: number): {
  slots: number;
  slotLevel: number;
} {
  if (warlockLevel <= 0) return { slots: 0, slotLevel: 0 };
  if (warlockLevel === 1) return { slots: 1, slotLevel: 1 };
  if (warlockLevel === 2) return { slots: 2, slotLevel: 1 };
  if (warlockLevel >= 3 && warlockLevel <= 4) return { slots: 2, slotLevel: 2 };
  if (warlockLevel >= 5 && warlockLevel <= 6) return { slots: 2, slotLevel: 3 };
  if (warlockLevel >= 7 && warlockLevel <= 8) return { slots: 2, slotLevel: 4 };
  if (warlockLevel >= 9 && warlockLevel <= 10) return { slots: 2, slotLevel: 5 };
  if (warlockLevel >= 11 && warlockLevel <= 16) return { slots: 3, slotLevel: 5 };
  return { slots: 4, slotLevel: 5 };
}
