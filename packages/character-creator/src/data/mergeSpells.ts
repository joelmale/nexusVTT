/**
 * Combines the SRD 5.1 (2014) and SRD 5.2.1 (2024) spell files into one list,
 * tagging each spell with its source edition. A spell present in both editions
 * keeps its 2024 text, in the position it first appeared.
 *
 * This replaces a committed, generated `5e-SRD-Spells-Merged.json` so the two
 * source files are the only copy of the data and the merged list cannot drift.
 */
export function mergeSpellSources<T extends { name?: string; level?: number }>(
  spells2014: readonly T[],
  spells2024: readonly T[],
): Array<T & { source: '2014' | '2024' }> {
  const merged = new Map<string, T & { source: '2014' | '2024' }>();
  const add = (spells: readonly T[], source: '2014' | '2024') => {
    for (const spell of spells) {
      if (!spell.name || spell.level === undefined) continue;
      merged.set(spell.name.toLowerCase().trim(), { ...spell, source });
    }
  };
  add(spells2014, '2014');
  add(spells2024, '2024'); // 2024 wins for spells in both editions
  return Array.from(merged.values());
}
