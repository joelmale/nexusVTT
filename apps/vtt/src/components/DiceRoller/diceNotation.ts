import type { DiceRoll } from '@/types/game';
import type { DieType } from './PolyhedralIcon';

/** Dice shown on the shelf, in display order. */
export const DIE_TYPES: DieType[] = [
  'd4',
  'd6',
  'd8',
  'd10',
  'd12',
  'd20',
  'd100',
];

/** Modifier chips offered by the d20 engine. */
export const MODIFIER_VALUES = [-5, -2, -1, 0, 1, 2, 3, 4, 5] as const;

export type DieCounters = Record<DieType, number>;

export const emptyCounters = (): DieCounters => ({
  d4: 0,
  d6: 0,
  d8: 0,
  d10: 0,
  d12: 0,
  d20: 0,
  d100: 0,
});

/** '+0', '+3', '-2'. */
export const formatModifier = (n: number): string =>
  n >= 0 ? `+${n}` : `${n}`;

/**
 * Builds the pool notation for the input, e.g. `2d8 + 1d6 + 3`.
 * Dice appear in `order` (the order they were first queued); any queued die
 * missing from `order` follows in shelf order.
 * Returns '' when no dice are queued (a lone modifier is not a roll).
 */
export const countersToNotation = (
  counters: DieCounters,
  modifier: number,
  order: DieType[] = [],
): string => {
  const ordered = [...order, ...DIE_TYPES].filter(
    (die, index, all) => all.indexOf(die) === index,
  );
  const parts = ordered.filter((die) => (counters[die] || 0) > 0).map(
    (die) => `${counters[die]}${die}`,
  );
  if (parts.length === 0) return '';
  let result = parts.join(' + ');
  if (modifier > 0) result += ` + ${modifier}`;
  else if (modifier < 0) result += ` - ${Math.abs(modifier)}`;
  return result;
};

/** `1d20`, `1d20+3`, `1d20-2`. */
export const d20Expression = (modifier: number): string => {
  if (modifier > 0) return `1d20+${modifier}`;
  if (modifier < 0) return `1d20-${Math.abs(modifier)}`;
  return '1d20';
};

/**
 * Compact log text such as `2d8 [2, 2] = 4` or `1d20+3 [14] = 17`.
 * The modifier is appended (` +3`) only when the expression does not already
 * end with it, so `2d8+3` is not rendered as `2d8+3 [..] +3`.
 */
export const formatRollBreakdown = (
  roll: Pick<
    DiceRoll,
    'expression' | 'results' | 'advResults' | 'modifier' | 'total'
  >,
): string => {
  const dice =
    roll.advResults && roll.advResults.length > 0
      ? `[${roll.results.join(', ')}] | [${roll.advResults.join(', ')}]`
      : `[${roll.results.join(', ')}]`;
  const modifierText = roll.modifier ? formatModifier(roll.modifier) : '';
  const expressionHasModifier =
    modifierText !== '' &&
    roll.expression.replace(/\s+/g, '').endsWith(modifierText);
  const suffix =
    modifierText && !expressionHasModifier ? ` ${modifierText}` : '';
  return `${roll.expression} ${dice}${suffix} = ${roll.total}`;
};
