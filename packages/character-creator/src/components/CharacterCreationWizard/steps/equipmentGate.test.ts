/**
 * Regression cover for the 2024 equipment step's completion gate.
 *
 * `Step6Equipment` gates both "Continue" and "Skip to Traits" on
 * `allChoicesMade`, which is:
 *
 *   equipmentMode === 'choices' ? validateEquipmentChoices(...)
 *     : equipmentMode === 'quickstart' || (equipmentMode === 'buy' && goldRolled)
 *
 * `background-choice` — the mode the 2024 flow *opens* in — has no true branch,
 * so a player sitting in it is blocked. That is fine as a transient fork, but
 * the step used to re-enter it on every mount, stranding anyone who had already
 * chosen behind a gate they had passed.
 */

import { describe, expect, it } from 'vitest';
import {
  getMissingEquipmentChoices,
  validateEquipmentChoices,
} from '../../../utils/equipmentSelectionUtils';
import type { EquipmentChoice } from '../../../types/dnd';

/** Mirrors the mode `Step6Equipment` initialises with. */
const initialEquipmentMode = (
  edition: string,
  equipmentChoice?: 'background' | 'gold' | null,
): 'quickstart' | 'buy' | 'choices' | 'background-choice' => {
  if (edition !== '2024') return 'quickstart';
  if (equipmentChoice === 'background') return 'quickstart';
  if (equipmentChoice === 'gold') return 'buy';
  return 'background-choice';
};

/** Mirrors the step's `allChoicesMade` expression. */
const allChoicesMade = (
  mode: ReturnType<typeof initialEquipmentMode>,
  choices: EquipmentChoice[],
  goldRolled: boolean,
): boolean =>
  mode === 'choices'
    ? validateEquipmentChoices(choices)
    : mode === 'quickstart' || (mode === 'buy' && goldRolled);

describe('2024 equipment gate', () => {
  it('opens on the fork when no choice has been made yet', () => {
    expect(initialEquipmentMode('2024', null)).toBe('background-choice');
    // The fork is deliberately blocking — the player must pick one.
    expect(allChoicesMade('background-choice', [], false)).toBe(false);
  });

  it('resumes a saved background choice instead of re-entering the fork', () => {
    const mode = initialEquipmentMode('2024', 'background');
    expect(mode).toBe('quickstart');
    expect(allChoicesMade(mode, [], false)).toBe(true);
  });

  it('resumes a saved gold choice with the gold already rolled', () => {
    const mode = initialEquipmentMode('2024', 'gold');
    expect(mode).toBe('buy');
    // `goldRolled` is seeded from the same saved choice.
    expect(allChoicesMade(mode, [], true)).toBe(true);
  });

  it('leaves the 2014 flow on its original path', () => {
    expect(initialEquipmentMode('2014')).toBe('quickstart');
    expect(allChoicesMade('quickstart', [], false)).toBe(true);
  });

  it('still blocks genuinely unmade per-item choices', () => {
    const choices = [
      { selected: 0 },
      { selected: null },
    ] as unknown as EquipmentChoice[];

    expect(allChoicesMade('choices', choices, false)).toBe(false);
    expect(getMissingEquipmentChoices(choices)).toEqual([2]);
  });

  it('passes once every per-item choice is filled', () => {
    const choices = [
      { selected: 0 },
      { selected: 1 },
    ] as unknown as EquipmentChoice[];

    expect(allChoicesMade('choices', choices, false)).toBe(true);
    expect(getMissingEquipmentChoices(choices)).toEqual([]);
  });
});
