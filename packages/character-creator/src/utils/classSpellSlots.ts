import { FULL_CASTER_SLOTS, getPactMagicSlots } from '@nexus/rules-5e';

/** Normalized single-class slots. Index zero is reserved for cantrips. */
export function classSpellSlots(
  classSlug: string,
  edition: '2014' | '2024',
  level: number,
): number[] {
  const result = Array<number>(10).fill(0);
  if (!Number.isInteger(level) || level < 1 || level > 20) return result;
  if (classSlug === 'warlock') {
    const pact = getPactMagicSlots(level);
    result[pact.slotLevel] = pact.slots;
    return result;
  }
  const half = ['paladin', 'ranger', 'artificer'].includes(classSlug);
  if (
    !half &&
    !['bard', 'cleric', 'druid', 'sorcerer', 'wizard'].includes(classSlug)
  )
    return result;
  if (
    ['paladin', 'ranger'].includes(classSlug) &&
    edition === '2014' &&
    level === 1
  )
    return result;
  const slots = FULL_CASTER_SLOTS[half ? Math.ceil(level / 2) : level] ?? {};
  for (let index = 1; index < result.length; index++)
    result[index] = slots[index] ?? 0;
  return result;
}
