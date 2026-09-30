import type {
  CampaignFixtureBundle,
  CampaignNote,
  NoteAnchor,
  NoteColor,
  NoteSize,
} from '@/demo/fixture-registry';

export const NOTE_COLORS: readonly NoteColor[] = [
  'yellow',
  'pink',
  'blue',
  'green',
  'purple',
  'orange',
  'gray',
];

export const NOTE_SIZES: readonly NoteSize[] = ['small', 'medium', 'large'];

/** Query-string value for the anchor filter: '' | 'campaign' | 'session:<id>' | 'scene:<id>'. */
export type AnchorFilter = string;

type AnchorSource = Pick<CampaignFixtureBundle, 'sessions' | 'sceneTemplates'>;

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

export function anchorLabel(bundle: AnchorSource, anchor: NoteAnchor): string {
  if (anchor.type === 'campaign') return 'Campaign-wide';
  if (anchor.type === 'session') {
    const session = bundle.sessions.find((item) => item.id === anchor.id);
    return session
      ? `Session ${session.number}: ${session.title}`
      : 'Unknown session';
  }
  const scene = bundle.sceneTemplates.find((item) => item.id === anchor.id);
  return scene ? `Scene: ${scene.title}` : 'Unknown scene';
}

export interface AnchorOption {
  value: string;
  label: string;
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

/** Filter options limited to anchors that notes actually use. */
export function filterOptions(
  bundle: AnchorSource & Pick<CampaignFixtureBundle, 'notes'>,
): AnchorOption[] {
  const used = new Set(bundle.notes.map((note) => anchorKey(note.anchor)));
  const options = anchorOptions(bundle).filter((option) =>
    used.has(option.value),
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

export function sortNotes(notes: readonly CampaignNote[]): CampaignNote[] {
  return notes
    .map((note, index) => ({ note, index }))
    .sort((a, b) => a.note.order - b.note.order || a.index - b.index)
    .map((entry) => entry.note);
}

export interface NotesBoardModel {
  /** All notes in global order. */
  all: CampaignNote[];
  /** Notes visible under the current filter and search, in global order. */
  visible: CampaignNote[];
}

export function buildNotesBoard(
  bundle: Pick<CampaignFixtureBundle, 'notes'>,
  filter: AnchorFilter,
  search = '',
): NotesBoardModel {
  const all = sortNotes(bundle.notes);
  const needle = search.trim().toLowerCase();
  const visible = all.filter((note) => {
    if (filter && anchorKey(note.anchor) !== filter) return false;
    if (!needle) return true;
    return (
      note.title.toLowerCase().includes(needle) ||
      note.body.toLowerCase().includes(needle)
    );
  });
  return { all, visible };
}

function placeVisible(
  allIds: readonly string[],
  visibleIds: readonly string[],
  nextVisible: readonly string[],
): string[] {
  const visibleSet = new Set(visibleIds);
  let cursor = 0;
  return allIds.map((existing) =>
    visibleSet.has(existing) ? nextVisible[cursor++] : existing,
  );
}

/**
 * Move `id` by `delta` places within the visible subset and return the new
 * whole-board id order. Hidden notes keep their slots; only the slots held by
 * visible notes are permuted, so `order` stays global and stable.
 */
export function moveWithinView(
  allIds: readonly string[],
  visibleIds: readonly string[],
  id: string,
  delta: number,
): string[] {
  const from = visibleIds.indexOf(id);
  if (from < 0) return [...allIds];
  const to = Math.max(0, Math.min(visibleIds.length - 1, from + delta));
  if (to === from) return [...allIds];
  const nextVisible = [...visibleIds];
  nextVisible.splice(from, 1);
  nextVisible.splice(to, 0, id);
  return placeVisible(allIds, visibleIds, nextVisible);
}

/** Move `id` to the position of `targetId` (drag and drop within the view). */
export function moveToTarget(
  allIds: readonly string[],
  visibleIds: readonly string[],
  id: string,
  targetId: string,
): string[] {
  const from = visibleIds.indexOf(id);
  const to = visibleIds.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return [...allIds];
  const nextVisible = [...visibleIds];
  nextVisible.splice(from, 1);
  nextVisible.splice(to, 0, id);
  return placeVisible(allIds, visibleIds, nextVisible);
}

export function nextNoteOrder(notes: readonly CampaignNote[]): number {
  return notes.reduce((max, note) => Math.max(max, note.order), -1) + 1;
}
