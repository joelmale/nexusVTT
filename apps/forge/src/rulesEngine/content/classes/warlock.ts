/**
 * Warlock Subclass Effects
 * Provides subclass feature grants sourced from subclassFeaturesByLevel.json.
 */

import type { SourcedEffect } from '../../types/effects';
import { subclassEffectsByClass } from './subclassEffects';

export const warlockEffects: SourcedEffect[] = [
  ...(subclassEffectsByClass.warlock ?? []),
];
