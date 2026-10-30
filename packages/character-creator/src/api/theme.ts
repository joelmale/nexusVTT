/**
 * The creator ships two themes: `parchment` (the default) and `dark`.
 *
 * Hosts may pass their own theme names. Anything dark maps to `dark`;
 * everything else, including no theme at all, maps to `parchment`. The
 * resolved value is what lands on the creator root's `data-theme`, so the
 * creator never inherits colours from the host page.
 */
export type CreatorTheme = 'parchment' | 'dark';

const DARK_THEMES = new Set(['dark', 'dark-colorful']);

export function resolveCreatorTheme(theme?: string | null): CreatorTheme {
  return theme && DARK_THEMES.has(theme) ? 'dark' : 'parchment';
}
