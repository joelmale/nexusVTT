import { useEffect, useId, useRef } from 'react';

import type { Draft } from './draftUtils';
import styles from './ConflictDialog.module.css';

const MAX_VALUE_LENGTH = 240;

function fieldLabel(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function display(value: unknown): string {
  if (value === undefined || value === null || value === '') return '(empty)';
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value);
  return text.length > MAX_VALUE_LENGTH
    ? `${text.slice(0, MAX_VALUE_LENGTH)}…`
    : text;
}

interface ConflictDialogProps {
  /** The fields this user tried to save. */
  mine: Draft;
  /** The entity as it is saved now, after the refetch. */
  latest: Draft;
  onReload: () => void;
  onKeepMine: () => void;
}

/**
 * Shown when a save is rejected because someone else (usually a co-DM) saved
 * the same entry first. It compares the fields this user changed against the
 * saved version so they can choose which to keep.
 */
export function ConflictDialog({
  mine,
  latest,
  onReload,
  onKeepMine,
}: ConflictDialogProps) {
  const titleId = useId();
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstButton.current?.focus();
  }, []);

  const keys = Object.keys(mine);

  return (
    <div className={styles.backdrop}>
      <div
        aria-describedby={`${titleId}-body`}
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.dialog}
        role="alertdialog"
      >
        <h3 className={styles.title} id={titleId}>
          This entry changed elsewhere
        </h3>
        <p className={styles.body} id={`${titleId}-body`}>
          Someone saved this entry after you opened it, so your edits were not
          saved. Keep your version to overwrite theirs, or reload theirs and
          drop your edits.
        </p>
        {keys.length > 0 ? (
          <table className={styles.compare}>
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Saved now</th>
                <th scope="col">Yours</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key}>
                  <th scope="row">{fieldLabel(key)}</th>
                  <td>{display(latest[key])}</td>
                  <td>{display(mine[key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <div className={styles.actions}>
          <button onClick={onReload} ref={firstButton} type="button">
            Reload latest
          </button>
          <button className={styles.primary} onClick={onKeepMine} type="button">
            Keep my changes
          </button>
        </div>
      </div>
    </div>
  );
}
