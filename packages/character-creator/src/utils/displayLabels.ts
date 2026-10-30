const SMALL_WORDS = new Set([
  'of',
  'the',
  'and',
  'with',
  'a',
  'an',
  'in',
  'on',
  'to',
  'for',
  'or',
]);

/**
 * Turns a raw identifier (slug, PascalCase key or hyphenated item name) into
 * display text: `pact-of-the-blade` -> "Pact of the Blade",
 * `SleightOfHand` -> "Sleight of Hand",
 * `Gaming-Set-(Matching-Choice)` -> "Gaming Set (Matching Choice)".
 */
export function humanizeId(id: string): string {
  const spaced = (id ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return '';
  return spaced
    .split(' ')
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      // Keep leading punctuation such as "(" and capitalize the first letter.
      return word.replace(/[A-Za-z]/, (letter) => letter.toUpperCase());
    })
    .join(' ');
}
