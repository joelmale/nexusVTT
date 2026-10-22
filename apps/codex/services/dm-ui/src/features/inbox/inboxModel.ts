import type {
  CampaignFixtureBundle,
  InboxNote,
} from '@/demo/fixture-registry';

/**
 * Returns true if the note has not been triaged to another entity yet.
 */
export function isUnfiled(note: InboxNote): boolean {
  return !note.triagedTo || !note.triagedTo.id;
}

/**
 * Counts unfiled notes waiting in the inbox.
 */
export function countUnfiled(notes: readonly InboxNote[] = []): number {
  return notes.filter(isUnfiled).length;
}

export interface InboxStats {
  total: number;
  unfiled: number;
  triaged: number;
}

/**
 * Computes high-level counts for the inbox.
 */
export function computeInboxStats(notes: readonly InboxNote[] = []): InboxStats {
  const total = notes.length;
  const unfiled = notes.filter(isUnfiled).length;
  const triaged = total - unfiled;
  return { total, unfiled, triaged };
}

export interface InboxFilterOptions {
  status?: 'all' | 'unfiled' | 'triaged';
  query?: string;
}

/**
 * Filters and sorts inbox notes, with newer notes first.
 */
export function filterInboxNotes(
  notes: readonly InboxNote[] = [],
  options: InboxFilterOptions = {},
): InboxNote[] {
  const status = options.status ?? 'all';
  const query = options.query?.trim().toLowerCase();

  return [...notes]
    .filter((note) => {
      if (status === 'unfiled' && !isUnfiled(note)) return false;
      if (status === 'triaged' && isUnfiled(note)) return false;
      if (query && !note.text.toLowerCase().includes(query)) return false;
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (isNaN(timeA) || isNaN(timeB)) return 0;
      return timeB - timeA;
    });
}

/**
 * Extracts a concise title or name from raw note text.
 */
export function extractFirstLineTitle(text: string, maxLength = 60): string {
  const trimmed = text.trim();
  if (!trimmed) return 'Untitled';
  const firstLine = trimmed.split('\n')[0].replace(/^[#*->\s]+/, '').trim();
  if (!firstLine) return 'Untitled';
  if (firstLine.length <= maxLength) return firstLine;
  return `${firstLine.slice(0, maxLength - 1)}…`;
}

/**
 * Produces a draft payload for an NPC converted from an inbox note.
 */
export function triageToNpcDraft(text: string): {
  name: string;
  role: string;
  summary: string;
  notes: string;
} {
  const name = extractFirstLineTitle(text, 40);
  return {
    name,
    role: 'Contact',
    summary: name,
    notes: text.trim(),
  };
}

/**
 * Produces a draft payload for a Quest converted from an inbox note.
 */
export function triageToQuestDraft(text: string): {
  title: string;
  description: string;
  status: 'active';
} {
  const title = extractFirstLineTitle(text, 60);
  return {
    title,
    description: text.trim(),
    status: 'active',
  };
}

/**
 * Produces a draft payload for a Secret converted from an inbox note.
 */
export function triageToSecretDraft(text: string): {
  text: string;
  revealed: boolean;
} {
  return {
    text: text.trim(),
    revealed: false,
  };
}

/**
 * Produces a draft payload for a General Note converted from an inbox note.
 */
export function triageToNoteDraft(text: string): {
  title: string;
  body: string;
  audience: 'none';
} {
  const title = extractFirstLineTitle(text, 50);
  return {
    title,
    body: text.trim(),
    audience: 'none',
  };
}

/**
 * Formats an ISO date into a readable string (e.g., "Oct 22, 2026").
 */
export function formatInboxDate(isoDate: string): string {
  if (!isoDate) return 'Unknown date';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Resolves a human-friendly label for what an inbox note was triaged to.
 */
export function describeTriageTarget(
  triagedTo: { kind: string; id: string },
  bundle: CampaignFixtureBundle,
): string {
  const { kind, id } = triagedTo;
  switch (kind) {
    case 'npc': {
      const npc = bundle.npcs.find((n) => n.id === id);
      return npc ? `NPC: ${npc.name}` : `NPC (${id})`;
    }
    case 'quest': {
      const quest = bundle.quests.find((q) => q.id === id);
      return quest ? `Quest: ${quest.title}` : `Quest (${id})`;
    }
    case 'secret': {
      const secret = bundle.secrets?.find((s) => s.id === id);
      if (secret) {
        const preview = extractFirstLineTitle(secret.text, 30);
        return `Secret: ${preview}`;
      }
      return `Secret (${id})`;
    }
    case 'note': {
      const note = bundle.notes.find((n) => n.id === id);
      return note ? `Note: ${note.title}` : `Note (${id})`;
    }
    case 'session': {
      const session = bundle.sessions.find((s) => s.id === id);
      return session ? `Session: ${session.title}` : `Session (${id})`;
    }
    default:
      return `${kind}: ${id}`;
  }
}
