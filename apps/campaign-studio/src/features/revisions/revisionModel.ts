export interface ObjectRevision {
  revision: number;
  createdAt: string;
  createdBy: string;
  snapshot: Record<string, unknown>;
  changeSummary?: string;
  synthetic?: boolean;
}

export interface FieldDiff {
  key: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  changed: boolean;
}

/** Humanize a camelCase or snake_case key into readable Title Case. */
export function humanizeFieldName(key: string): string {
  const words = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .split(/\s+/);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Pretty-print an unknown field value for display in a diff. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim() ? value : '(empty string)';
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty list)';
    return value
      .map((item) =>
        typeof item === 'object' && item !== null
          ? JSON.stringify(item)
          : String(item),
      )
      .join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/** Compute field-by-field differences between two snapshots. */
export function computeDiff(
  previousSnapshot: Record<string, unknown>,
  currentSnapshot: Record<string, unknown>,
): FieldDiff[] {
  const allKeys = Array.from(
    new Set([...Object.keys(previousSnapshot), ...Object.keys(currentSnapshot)]),
  ).filter((k) => !['id', 'campaignId', 'createdAt', 'updatedAt'].includes(k));

  const diffs: FieldDiff[] = [];

  for (const key of allKeys) {
    const oldValue = previousSnapshot[key];
    const newValue = currentSnapshot[key];

    const oldStr = JSON.stringify(oldValue);
    const newStr = JSON.stringify(newValue);
    const changed = oldStr !== newStr;

    diffs.push({
      key,
      label: humanizeFieldName(key),
      oldValue,
      newValue,
      changed,
    });
  }

  // Changed fields first, then alphabetical
  return diffs.sort((a, b) => {
    if (a.changed !== b.changed) {
      return a.changed ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
  });
}

/**
 * Creates a patch object of all keys from targetSnapshot that differ from currentDraft,
 * restoring targetSnapshot.
 */
export function restoreRevisionPatch(
  targetSnapshot: Record<string, unknown>,
  currentDraft: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(targetSnapshot)) {
    if (['id', 'campaignId', 'createdAt', 'updatedAt'].includes(key)) continue;
    if (JSON.stringify(val) !== JSON.stringify(currentDraft[key])) {
      patch[key] = val;
    }
  }

  // If a key existed in currentDraft but was absent in targetSnapshot, set it to empty/undefined
  for (const key of Object.keys(currentDraft)) {
    if (['id', 'campaignId', 'createdAt', 'updatedAt'].includes(key)) continue;
    if (!(key in targetSnapshot)) {
      patch[key] = '';
    }
  }

  return patch;
}

/**
 * Generate synthetic demonstration revisions when viewing fixture/demo campaigns
 * or entities that do not yet have server-side revision logs.
 */
export function generateSyntheticRevisions(
  _objectId: string,
  currentDraft: Record<string, unknown>,
): ObjectRevision[] {
  const now = Date.now();
  const title = (currentDraft.title || currentDraft.name || 'Entity') as string;

  // Rev 3 (Current)
  const rev3: ObjectRevision = {
    revision: 3,
    createdAt: new Date(now - 1000 * 60 * 12).toISOString(), // 12 mins ago
    createdBy: 'Dungeon Master',
    snapshot: { ...currentDraft },
    changeSummary: `Updated ${title} details and notes`,
    synthetic: true,
  };

  // Rev 2 (Earlier edit with slightly different notes/fields)
  const rev2Snapshot: Record<string, unknown> = { ...currentDraft };
  if ('notes' in rev2Snapshot) {
    rev2Snapshot.notes = 'Initial preparation draft with preliminary notes.';
  } else if ('description' in rev2Snapshot) {
    rev2Snapshot.description = 'Early draft description awaiting encounter tuning.';
  } else if ('body' in rev2Snapshot) {
    rev2Snapshot.body = 'Rough notes outline.';
  } else if ('tactics' in rev2Snapshot) {
    rev2Snapshot.tactics = 'Standard combat maneuvers.';
  }

  const rev2: ObjectRevision = {
    revision: 2,
    createdAt: new Date(now - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    createdBy: 'Dungeon Master',
    snapshot: rev2Snapshot,
    changeSummary: `Refined rules and description`,
    synthetic: true,
  };

  // Rev 1 (Creation snapshot)
  const rev1Snapshot: Record<string, unknown> = {
    ...rev2Snapshot,
  };
  if ('title' in rev1Snapshot) rev1Snapshot.title = title;
  if ('name' in rev1Snapshot) rev1Snapshot.name = title;

  const rev1: ObjectRevision = {
    revision: 1,
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    createdBy: 'Dungeon Master',
    snapshot: rev1Snapshot,
    changeSummary: `Created ${title}`,
    synthetic: true,
  };

  return [rev3, rev2, rev1];
}

/** Format a timestamp into a clean, human-readable date and time. */
export function formatRevisionDate(isoDateStr: string): string {
  try {
    const d = new Date(isoDateStr);
    if (Number.isNaN(d.getTime())) return isoDateStr;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDateStr;
  }
}
