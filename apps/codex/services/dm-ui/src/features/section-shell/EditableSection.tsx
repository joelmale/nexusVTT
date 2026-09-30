import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';

import type { EditableKind, SaveResult, SaveState } from './bundleStore';
import { diffDraft } from './draftUtils';
import styles from './EditableSection.module.css';
import { useSectionBundle } from './SectionContext';

type Draft = Record<string, unknown>;

/** Banner for a `SaveState`. `saved` only ever appears after an ok result. */
export function SaveBanner({
  state,
  error,
  onReload,
}: {
  state: SaveState;
  error?: string;
  onReload?: () => void;
}) {
  if (state === 'idle') return null;
  if (state === 'conflict') {
    return (
      <div className={`${styles.banner} ${styles.conflict}`} role="alert">
        <span>This entry changed elsewhere. Your edits were not saved.</span>
        <button onClick={onReload} type="button">
          Reload latest
        </button>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className={`${styles.banner} ${styles.error}`} role="alert">
        Could not save{error ? `: ${error}` : '.'}
      </div>
    );
  }
  return (
    <div
      className={`${styles.banner} ${state === 'saved' ? styles.saved : ''}`}
      role="status"
    >
      {state === 'saving' ? 'Saving…' : 'Saved.'}
    </div>
  );
}

interface EditableSectionProps {
  kind: EditableKind;
  /** Entity id; switching ids resets edit mode. */
  id: string;
  /** Detail title, rendered as the pane `h2`. */
  heading: ReactNode;
  /** Current entity values the form edits, e.g. the NPC record. */
  initialDraft: Draft;
  /** Read view (always shown when not editing). */
  children: ReactNode;
  /** Form fields. Call `setDraft({ ...draft, field: value })` on change. */
  renderForm: (draft: Draft, setDraft: (next: Draft) => void) => ReactNode;
  /** Defaults to only the changed keys of the draft. */
  toPatch?: (draft: Draft, initial: Draft) => Draft;
  /** Extra header content next to the heading (badges). */
  headerExtras?: ReactNode;
}

/**
 * Detail-pane scaffold: heading + Edit/Save/Cancel + save banner. The Edit
 * button only appears when the store is editable (real campaigns), so the same
 * component works for read-only examples.
 */
export function EditableSection({
  kind,
  id,
  heading,
  initialDraft,
  children,
  renderForm,
  toPatch = diffDraft,
  headerExtras,
}: EditableSectionProps) {
  const { store } = useSectionBundle();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string>();
  const headingId = useId();
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
    setEditing(false);
    setState('idle');
    setError(undefined);
  }, [id]);

  const startEditing = () => {
    setDraft(initialDraft);
    setState('idle');
    setError(undefined);
    setEditing(true);
  };

  const cancel = () => {
    requestId.current += 1;
    setEditing(false);
    setState('idle');
    setError(undefined);
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    const patch = toPatch(draft, initialDraft);
    if (Object.keys(patch).length === 0) {
      cancel();
      return;
    }
    const current = ++requestId.current;
    setState('saving');
    setError(undefined);
    let result: SaveResult;
    try {
      result = await store.updateItem(kind, id, patch);
    } catch (thrown) {
      result = {
        ok: false,
        error: thrown instanceof Error ? thrown.message : 'Request failed',
      };
    }
    if (current !== requestId.current) return;
    if (result.ok) {
      setState('saved');
      setEditing(false);
    } else if (result.conflict) {
      setState('conflict');
    } else {
      setState('error');
      setError(result.error);
    }
  };

  const reloadLatest = useCallback(async () => {
    await store.reload();
    requestId.current += 1;
    setEditing(false);
    setState('idle');
    setError(undefined);
  }, [store]);

  return (
    <article aria-labelledby={headingId} className={styles.editable}>
      <header className={styles.header}>
        <h2 id={headingId}>{heading}</h2>
        {headerExtras}
        {store.editable ? (
          <div className={styles.actions}>
            {editing ? (
              <>
                <button
                  disabled={state === 'saving'}
                  onClick={() => void save()}
                  type="button"
                >
                  Save
                </button>
                <button
                  disabled={state === 'saving'}
                  onClick={cancel}
                  type="button"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={startEditing} type="button">
                Edit
              </button>
            )}
          </div>
        ) : null}
      </header>
      <SaveBanner error={error} onReload={reloadLatest} state={state} />
      {editing ? (
        <form
          aria-label="Edit form"
          className={styles.form}
          onSubmit={(event) => void save(event)}
        >
          {renderForm(draft, setDraft)}
        </form>
      ) : (
        children
      )}
    </article>
  );
}

interface AddRowProps {
  kind: EditableKind;
  /** Button text, e.g. "Add NPC". */
  label: string;
  /** Field that receives the typed name, e.g. `name` or `title`. */
  nameField: string;
  /** Extra fields for the new object. */
  defaults?: Draft;
  /** Section route segment, e.g. `npcs`; the new item is selected after add. */
  sectionPath: string;
}

/**
 * The one "Add" row at the bottom of a section list. Hidden when the store is
 * not editable. Creates the object, then navigates to it.
 */
export function AddRow({
  kind,
  label,
  nameField,
  defaults,
  sectionPath,
}: AddRowProps) {
  const { store, basePath } = useSectionBundle();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inputId = useId();

  if (!store.editable) return null;

  const close = () => {
    setOpen(false);
    setValue('');
    setError(undefined);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = value.trim();
    if (!name) {
      setError('Enter a name first.');
      return;
    }
    setBusy(true);
    setError(undefined);
    const result = await store.addItem(kind, {
      ...defaults,
      [nameField]: name,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not add.');
      return;
    }
    close();
    if (result.id) {
      navigate(`${basePath}/${sectionPath}/${encodeURIComponent(result.id)}`);
    }
  };

  if (!open) {
    return (
      <div className={styles.addRow}>
        <button onClick={() => setOpen(true)} type="button">
          + {label}
        </button>
      </div>
    );
  }
  return (
    <form
      aria-label={label}
      className={`${styles.addRow} ${styles.addForm}`}
      onSubmit={(event) => void submit(event)}
    >
      <label htmlFor={inputId}>{label} name</label>
      <input
        autoFocus
        id={inputId}
        onChange={(event) => setValue(event.target.value)}
        value={value}
      />
      <div className={styles.actions}>
        <button disabled={busy} type="submit">
          {busy ? 'Adding…' : 'Add'}
        </button>
        <button disabled={busy} onClick={close} type="button">
          Cancel
        </button>
      </div>
      {error ? (
        <p className={styles.addError} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
