/**
 * `@` mentions in campaign text. A mention is stored as `@[Label](ref:<id>)`.
 * The id is the link; the label is only the title at the time it was typed, so
 * renaming an object never breaks a mention (readers resolve the id to the
 * current title) and a deleted target can still be shown as "missing: Label".
 */

const TOKEN = /@\[([^\]\n]*)\]\(ref:([\w-]+)\)/g;
const QUERY_CHAR = /[^\s[\]()@]/;

export interface MentionMatch {
  id: string;
  label: string;
  start: number;
  end: number;
}

export function findMentions(text: string): MentionMatch[] {
  return [...text.matchAll(TOKEN)].map((match) => ({
    id: match[2],
    label: match[1],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

/** Distinct ids mentioned in `text`, in first-seen order. */
export function mentionIds(text: string): string[] {
  return [...new Set(findMentions(text).map((match) => match.id))];
}

export type MentionSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; id: string; label: string };

export function splitMentions(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let last = 0;
  for (const match of findMentions(text)) {
    if (match.start > last) {
      segments.push({ type: 'text', text: text.slice(last, match.start) });
    }
    segments.push({ type: 'mention', id: match.id, label: match.label });
    last = match.end;
  }
  if (last < text.length) segments.push({ type: 'text', text: text.slice(last) });
  return segments;
}

export function formatMention(label: string, id: string): string {
  const safe = label.replace(/[\]\n[]/g, ' ').trim() || 'Untitled';
  return `@[${safe}](ref:${id})`;
}

export interface ActiveMention {
  /** Index of the `@`. */
  start: number;
  /** Text typed after the `@`, up to the caret. */
  query: string;
}

/**
 * The mention being typed at `caret`, if any: an `@` at the start of the text
 * or after whitespace, followed only by plain characters up to the caret.
 */
export function activeMention(
  text: string,
  caret: number,
): ActiveMention | null {
  let index = caret - 1;
  while (index >= 0 && QUERY_CHAR.test(text[index])) index -= 1;
  if (index < 0 || text[index] !== '@') return null;
  if (index > 0 && !/\s/.test(text[index - 1])) return null;
  // `@[` starts a finished token, not a new mention.
  if (text[index + 1] === '[') return null;
  return { start: index, query: text.slice(index + 1, caret) };
}

/** Replaces the typed `@query` with a mention token and a trailing space. */
export function applyMention(
  text: string,
  active: ActiveMention,
  caret: number,
  label: string,
  id: string,
): { text: string; caret: number } {
  const token = `${formatMention(label, id)} `;
  return {
    text: text.slice(0, active.start) + token + text.slice(caret),
    caret: active.start + token.length,
  };
}
