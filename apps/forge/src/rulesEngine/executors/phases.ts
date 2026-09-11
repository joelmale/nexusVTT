/**
 * Phase Execution System
 * Defines the order in which effects are applied
 *
 * PURE SEPARATION RULE: This defines only the ORDER, not the logic.
 * All game logic is in effect data.
 */

/**
 * Execution phase definition
 */
export interface ExecutionPhase {
  name: string;
  sourceTypes: string[]; // Prefixes to match against sourceId (e.g., 'species:', 'class:')
  priority: number; // Lower = earlier
}

/**
 * Standard execution phases
 *
 * Effects are applied in this order to ensure correct precedence.
 * For example, species bonuses should apply before class features.
 */
export const EXECUTION_PHASES: ExecutionPhase[] = [
  {
    name: 'species',
    sourceTypes: ['species:', 'lineage:'],
    priority: 1,
  },
  {
    name: 'background',
    sourceTypes: ['background:'],
    priority: 2,
  },
  {
    name: 'class',
    sourceTypes: ['class:'],
    priority: 3,
  },
  {
    name: 'subclass',
    sourceTypes: ['subclass:'],
    priority: 4,
  },
  {
    name: 'feats',
    sourceTypes: ['feat:'],
    priority: 5,
  },
  {
    name: 'items',
    sourceTypes: ['item:', 'equipment:'],
    priority: 6,
  },
  {
    name: 'conditions',
    sourceTypes: ['condition:'],
    priority: 7,
  },
  {
    name: 'temporary',
    sourceTypes: ['spell:', 'temporary:'],
    priority: 8,
  },
];

/**
 * Determine which phase a sourced effect belongs to
 *
 * @param sourceId - The sourceId from a SourcedEffect
 * @returns Phase name or 'unknown'
 */
export function getPhaseForSource(sourceId: string): string {
  for (const phase of EXECUTION_PHASES) {
    for (const prefix of phase.sourceTypes) {
      if (sourceId.startsWith(prefix)) {
        return phase.name;
      }
    }
  }
  return 'unknown';
}

/**
 * Group effects by phase
 *
 * @param effects - Array of sourced effects
 * @returns Map of phase name to effects
 */
export function groupEffectsByPhase<T extends { sourceId: string }>(
  effects: T[]
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};

  for (const effect of effects) {
    const phase = getPhaseForSource(effect.sourceId);
    if (!grouped[phase]) {
      grouped[phase] = [];
    }
    grouped[phase].push(effect);
  }

  return grouped;
}

/**
 * Sort effects by priority within a phase
 * Currently uses sourceId alphabetically, but can be extended
 * with explicit priority field on effects
 *
 * @param effects - Array of sourced effects
 * @returns Sorted array
 */
export function sortEffectsByPriority<T extends { sourceId: string }>(effects: T[]): T[] {
  return [...effects].sort((a, b) => {
    // For now, sort alphabetically by sourceId
    // Future: could sort by effect.priority if specified
    return a.sourceId.localeCompare(b.sourceId);
  });
}
