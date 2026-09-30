import type {
  CampaignFixtureBundle,
  CampaignNote,
  NoteAnchor,
  NoteAudience,
} from '@/demo/fixture-registry';

export type ShareMode = 'none' | 'all' | 'selected';

type AnchorSource = Pick<CampaignFixtureBundle, 'sessions' | 'sceneTemplates'>;

export interface AnchorOption {
  value: string;
  label: string;
}

/** Query/select value for an anchor: 'campaign' | 'session:<id>' | 'scene:<id>'. */
export function anchorKey(anchor: NoteAnchor): string {
  return anchor.type === 'campaign'
    ? 'campaign'
    : `${anchor.type}:${anchor.id}`;
}

export function anchorFromKey(key: string): NoteAnchor {
  const [type, ...rest] = key.split(':');
  const id = rest.join(':');
  if ((type === 'session' || type === 'scene') && id) return { type, id };
  return { type: 'campaign' };
}

/** Short label for list rows: "Campaign-wide", "Session 3", "Scene: Harbor". */
export function anchorShortLabel(
  bundle: AnchorSource,
  anchor: NoteAnchor,
): string {
  if (anchor.type === 'campaign') return 'Campaign-wide';
  if (anchor.type === 'session') {
    const session = bundle.sessions.find((item) => item.id === anchor.id);
    return session ? `Session ${session.number}` : 'Unknown session';
  }
  const scene = bundle.sceneTemplates.find((item) => item.id === anchor.id);
  return scene ? `Scene: ${scene.title}` : 'Unknown scene';
}

/** Full label for selects and the detail pane. */
export function anchorLabel(bundle: AnchorSource, anchor: NoteAnchor): string {
  if (anchor.type === 'session') {
    const session = bundle.sessions.find((item) => item.id === anchor.id);
    return session
      ? `Session ${session.number}: ${session.title}`
      : 'Unknown session';
  }
  return anchorShortLabel(bundle, anchor);
}

/** Every anchor a note may take: campaign, each session, each scene. */
export function anchorOptions(bundle: AnchorSource): AnchorOption[] {
  return [
    { value: 'campaign', label: 'Campaign-wide' },
    ...bundle.sessions.map((session) => ({
      value: `session:${session.id}`,
      label: `Session ${session.number}: ${session.title}`,
    })),
    ...bundle.sceneTemplates.map((scene) => ({
      value: `scene:${scene.id}`,
      label: `Scene: ${scene.title}`,
    })),
  ];
}

/** Filter options: Campaign-wide plus the sessions/scenes that notes use. */
export function filterOptions(
  bundle: AnchorSource & Pick<CampaignFixtureBundle, 'notes'>,
): AnchorOption[] {
  const used = new Set(bundle.notes.map((note) => anchorKey(note.anchor)));
  const options = anchorOptions(bundle).filter(
    (option) => option.value === 'campaign' || used.has(option.value),
  );
  // Anchors pointing at deleted sessions/scenes stay filterable.
  for (const key of used) {
    if (!options.some((option) => option.value === key)) {
      options.push({
        value: key,
        label: anchorLabel(bundle, anchorFromKey(key)),
      });
    }
  }
  return options;
}

export function isShared(note: Pick<CampaignNote, 'audience'>): boolean {
  return note.audience !== 'none';
}

export function shareMode(audience: NoteAudience): ShareMode {
  if (audience === 'all') return 'all';
  return Array.isArray(audience) && audience.length > 0 ? 'selected' : 'none';
}

/** Draft share controls back to a stored audience ('selected' with nobody = 'none'). */
export function audienceFromShare(
  mode: ShareMode,
  characterIds: readonly string[],
): NoteAudience {
  if (mode === 'all') return 'all';
  if (mode === 'selected' && characterIds.length > 0) return [...characterIds];
  return 'none';
}

/** Read-view sentence for a shared note. */
export function audienceSummary(
  audience: NoteAudience,
  characters: ReadonlyArray<{ id: string; name: string }>,
): string {
  if (audience === 'all') return 'Shared with all players';
  if (Array.isArray(audience) && audience.length > 0) {
    const names = audience.map(
      (id) => characters.find((character) => character.id === id)?.name ?? id,
    );
    return `Shared with ${names.join(', ')}`;
  }
  return 'Private (DM only)';
}

/** One-line plain preview of a markdown body. */
export function bodyPreview(body: string, max = 90): string {
  const flat = body
    .replace(/[*`#]/g, '')
    .replace(/^\s*[-\d.)]+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

export interface NoteRow {
  id: string;
  title: string;
  preview: string;
  anchorLabel: string;
  shared: boolean;
}

export interface NotesModel {
  total: number;
  rows: NoteRow[];
  anchorOptions: AnchorOption[];
}

export interface NotesQuery {
  q?: string;
  /** '' (all) | 'campaign' | 'session:<id>' | 'scene:<id>'. */
  anchor?: string;
}

/**
 * Notes sorted by stored order (ties keep bundle order, then title), filtered
 * by anchor and a case-insensitive title/body search.
 */
export function buildNotesModel(
  bundle: Pick<
    CampaignFixtureBundle,
    'notes' | 'sessions' | 'sceneTemplates'
  >,
  query: NotesQuery = {},
): NotesModel {
  const needle = (query.q ?? '').trim().toLowerCase();
  const sorted = bundle.notes
    .map((note, index) => ({ note, index }))
    .sort(
      (a, b) =>
        a.note.order - b.note.order ||
        a.index - b.index ||
        a.note.title.localeCompare(b.note.title),
    )
    .map((entry) => entry.note);
  const rows = sorted
    .filter((note) => {
      if (query.anchor && anchorKey(note.anchor) !== query.anchor) return false;
      if (!needle) return true;
      return (
        note.title.toLowerCase().includes(needle) ||
        note.body.toLowerCase().includes(needle)
      );
    })
    .map((note) => ({
      id: note.id,
      title: note.title,
      preview: bodyPreview(note.body),
      anchorLabel: anchorShortLabel(bundle, note.anchor),
      shared: isShared(note),
    }));
  return {
    total: bundle.notes.length,
    rows,
    anchorOptions: filterOptions(bundle),
  };
}

export interface NoteDraft {
  title: string;
  body: string;
  anchor: string;
  share: ShareMode;
  characterIds: string[];
}

export function noteToDraft(note: CampaignNote): NoteDraft {
  return {
    title: note.title,
    body: note.body,
    anchor: anchorKey(note.anchor),
    share: shareMode(note.audience),
    characterIds: Array.isArray(note.audience) ? [...note.audience] : [],
  };
}

/** Changed fields only, in the shape the store's `updateItem('note', ...)` takes. */
export function noteDraftToPatch(
  draft: NoteDraft,
  initial: NoteDraft,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (draft.title !== initial.title) patch.title = draft.title;
  if (draft.body !== initial.body) patch.body = draft.body;
  if (draft.anchor !== initial.anchor) patch.anchor = anchorFromKey(draft.anchor);
  const next = audienceFromShare(draft.share, draft.characterIds);
  const before = audienceFromShare(initial.share, initial.characterIds);
  if (JSON.stringify(next) !== JSON.stringify(before)) patch.audience = next;
  return patch;
}
