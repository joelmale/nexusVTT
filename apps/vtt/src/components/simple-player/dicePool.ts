import { formatModifier } from '@/utils/characterRolls';

export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;

export type DieSides = (typeof DICE_SIDES)[number];
export type DicePool = Partial<Record<DieSides, number>>;

/** `{6: 2, 8: 1}` + 3 → `2d6+1d8+3`. */
export function buildPoolExpression(pool: DicePool, modifier: number): string {
  const dice = DICE_SIDES.filter((sides) => (pool[sides] ?? 0) > 0)
    .map((sides) => `${pool[sides]}d${sides}`)
    .join('+');
  if (!dice) return '';
  return modifier === 0 ? dice : `${dice}${formatModifier(modifier)}`;
}
