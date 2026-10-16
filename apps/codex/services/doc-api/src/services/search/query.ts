const MAX_TERMS = 24;

/**
 * Split free text into lowercase alphanumeric terms. The search ORs them so a long
 * question still finds something; ranking then favours documents that match more of them.
 */
export function tokenizeQuery(raw: string): string[] {
  const tokens = raw.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(tokens)].slice(0, MAX_TERMS);
}

/**
 * A to_tsquery() string: terms joined with `|`. Only letters and digits survive
 * tokenizeQuery, so the result cannot inject tsquery operators. Returns '' when
 * there is nothing searchable.
 */
export function buildOrTsQuery(raw: string): string {
  return tokenizeQuery(raw).join(' | ');
}

/** Separates fragments in a ts_headline() result (its FragmentDelimiter option). */
export const FRAGMENT_DELIMITER = ' ||| ';

/** Split a ts_headline() result into the fragments that contain a highlight. */
export function splitHeadline(headline: string | null | undefined): string[] {
  if (!headline || !headline.includes('<em>')) return [];
  return headline
    .split(FRAGMENT_DELIMITER)
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.includes('<em>'));
}
