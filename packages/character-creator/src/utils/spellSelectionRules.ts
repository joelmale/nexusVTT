import { getSpellsForClass } from '../services/dataService';
import type { SpellSelectionData } from '../types/dnd';

/** A Wizard starts with 6 spells in their spellbook and gains 2 per level after 1st. */
export function getWizardSpellbookSize(level: number): number {
  return 6 + 2 * (Math.max(1, Math.floor(level)) - 1);
}

const CLASS_DEPENDENT_FIELDS = [
  'selectedCantrips',
  'knownSpells',
  'preparedSpells',
  'spellbook',
  'dailyPrepared',
] as const;

/**
 * Drops picks that are not on the current class's spell list, so choices made
 * for a previous class cannot keep counting after the class changes. Returns
 * the same object when nothing needs pruning.
 */
export function pruneSpellSelectionForClass(
  selection: SpellSelectionData,
  classSlug: string,
  edition?: '2014' | '2024',
): SpellSelectionData {
  const allowed = new Set(
    getSpellsForClass(classSlug, edition).map((spell) => spell.slug),
  );
  let changed = false;
  const next: SpellSelectionData = { ...selection };
  for (const field of CLASS_DEPENDENT_FIELDS) {
    const current = selection[field];
    if (!current) continue;
    const kept = current.filter((slug) => allowed.has(slug));
    if (kept.length !== current.length) {
      next[field] = kept;
      changed = true;
    }
  }
  return changed ? next : selection;
}
