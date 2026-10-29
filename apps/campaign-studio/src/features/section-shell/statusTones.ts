export type Tone = 'positive' | 'warning' | 'danger' | 'neutral' | 'info';

/** Domain enum value -> tone. Badges always render the text too. */
export const STATUS_TONES: Record<string, Tone> = {
  // session
  complete: 'positive',
  planned: 'info',
  draft: 'neutral',
  // act / lifecycle
  active: 'positive',
  paused: 'warning',
  // faction
  ally: 'positive',
  neutral: 'neutral',
  opposition: 'danger',
  unknown: 'neutral',
  // quest
  'on-hold': 'warning',
  'not-started': 'neutral',
  // objective
  blocked: 'danger',
  pending: 'neutral',
  // clue
  unresolved: 'warning',
  'partially-understood': 'info',
  resolved: 'positive',
  // priority
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
  // encounter difficulty
  moderate: 'warning',
  // handout visibility
  shared: 'positive',
  'dm-only': 'neutral',
  // plan readiness
  ready: 'positive',
  'needs-review': 'warning',
};

export function toneFor(value: string): Tone {
  return STATUS_TONES[value] ?? 'neutral';
}

/** "on-hold" -> "On hold". */
export function humanize(value: string): string {
  const spaced = value.replace(/[-_]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
