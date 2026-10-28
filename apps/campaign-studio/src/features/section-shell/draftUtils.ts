export type Draft = Record<string, unknown>;

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Keys whose value differs from `initial`; the default patch. */
export function diffDraft(draft: Draft, initial: Draft): Draft {
  const patch: Draft = {};
  for (const key of Object.keys(draft)) {
    if (!sameValue(initial[key], draft[key])) patch[key] = draft[key];
  }
  return patch;
}
