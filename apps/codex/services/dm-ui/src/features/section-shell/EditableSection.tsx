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

import type {
  BundleStore,
  EditableKind,
  SaveResult,
  SaveState,
} from './bundleStore';
import { EditableCommitContext } from './EditableCommitContext';
import { diffDraft } from './draftUtils';
import styles from './EditableSection.module.css';
import { RemoveItemButton } from './RemoveItemButton';
import { useSectionBundle } from './SectionContext';

type Draft = Record<string, unknown>;

/** Banner for a `SaveState`. `saved` only ever appears after an ok result. */
export function SaveBanner({
  state,
  error,
  onReload,
  onKeepMine,
}: {
  state: SaveState;
  error?: string;
  onReload?: () => void;
  onKeepMine?: () => void;
}) {
  if (state === 'idle') return null;
  if (state === 'conflict') {
    return (
      <div className={`${styles.banner} ${styles.conflict}`} role="alert">
        <span>This entry changed elsewhere. Your edits were not saved.</span>
        <button onClick={onReload} type="button">
          Reload latest
        </button>
        {onKeepMine ? (
          <button onClick={onKeepMine} type="button">
            Keep my changes
          </button>
        ) : null}
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
  /** Entity id; switching ids flushes pending edits and resets edit mode. */
  id: string;
  /** Detail title, rendered as the pane `h2`. */
  heading: ReactNode;
  /** Current entity values the form edits, e.g. the NPC record. */
  initialDraft: Draft;
  /** Read view (always shown when not editing). */
  children: ReactNode;
  /**
   * Form fields. Call `setDraft({ ...draft, field: value })` on change. Fields
   * save when they lose focus; for changes without focus call
   * `useEditableCommit()`.
   */
  renderForm: (draft: Draft, setDraft: (next: Draft) => void) => ReactNode;
  /** Defaults to only the changed keys of the draft. */
  toPatch?: (draft: Draft, initial: Draft) => Draft;
  /** Extra header content next to the heading (badges). */
  headerExtras?: ReactNode;
  /** Header buttons rendered next to Edit/Done (e.g. Remove). */
  headerActions?: ReactNode;
  /**
   * Section route segment (e.g. `npcs`). When set, the header shows a Remove
   * button that archives the item and returns to the section list.
   */
  listPath?: string;
}

/**
 * Per-entity autosave state. It lives outside React state so a flush can run
 * after the component moved to another id or unmounted.
 */
interface Session {
  kind: EditableKind;
  id: string;
  store: BundleStore;
  toPatch: (draft: Draft, initial: Draft) => Draft;
  initial: Draft;
  initialKey: string;
  draft: Draft;
  /** Draft last accepted by the server; the diff base until `initial` moves. */
  savedBase: Draft | null;
  inFlight: Promise<void> | null;
  pending: boolean;
  paused: boolean;
  failed: boolean;
  lastPatch: Draft;
  lastSentDraft: Draft;
}

function hasKeys(patch: Draft): boolean {
  return Object.keys(patch).length > 0;
}

function pendingPatch(session: Session): Draft {
  return session.toPatch(session.draft, session.savedBase ?? session.initial);
}

/**
 * Detail-pane scaffold: heading + Edit/Done + autosave. In edit mode every
 * field commits when it loses focus (see `useEditableCommit` for controls that
 * do not take focus). The Edit button only appears when the store is editable
 * (real campaigns), so the same component works for read-only examples.
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
  headerActions,
  listPath,
}: EditableSectionProps) {
  const { store } = useSectionBundle();
  const [editing, setEditing] = useState(false);
  const [draft, setDraftState] = useState<Draft>(initialDraft);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [commitTick, setCommitTick] = useState(0);
  const headingId = useId();
  const sessionRef = useRef<Session | null>(null);
  const commitRequested = useRef(false);

  const live = (session: Session) => sessionRef.current === session;

  const refreshDirty = (session: Session) => {
    if (live(session)) setDirty(hasKeys(pendingPatch(session)));
  };

  const attempt = (session: Session, override?: Draft): Promise<void> => {
    const patch = override ?? pendingPatch(session);
    if (!hasKeys(patch)) return Promise.resolve();
    const sent = override ? session.lastSentDraft : session.draft;
    session.lastPatch = patch;
    session.lastSentDraft = sent;
    session.failed = false;
    if (live(session)) {
      setState('saving');
      setError(undefined);
    }
    const run = (async () => {
      let result: SaveResult;
      try {
        result = await session.store.updateItem(
          session.kind,
          session.id,
          patch,
        );
      } catch (thrown) {
        result = {
          ok: false,
          error: thrown instanceof Error ? thrown.message : 'Request failed',
        };
      }
      session.inFlight = null;
      if (result.ok) {
        session.savedBase = sent;
        if (live(session)) setState('saved');
      } else if (result.conflict) {
        session.failed = true;
        session.paused = true;
        session.pending = false;
        if (live(session)) setState('conflict');
      } else {
        session.failed = true;
        session.pending = false;
        if (live(session)) {
          setState('error');
          setError(result.error);
        }
      }
      refreshDirty(session);
      if (result.ok && session.pending) {
        session.pending = false;
        requestSave(session);
      }
    })();
    session.inFlight = run;
    return run;
  };

  const requestSave = (session: Session) => {
    if (session.paused) return;
    if (session.inFlight) {
      session.pending = true;
      return;
    }
    void attempt(session);
  };

  /** Resolves true when nothing is left unsaved. */
  const flush = async (session: Session): Promise<boolean> => {
    for (;;) {
      if (session.inFlight) {
        await session.inFlight;
        continue;
      }
      if (session.paused || session.failed) return false;
      if (!hasKeys(pendingPatch(session))) return true;
      await attempt(session);
    }
  };

  // Declared before the sync effect below: the cleanup flushes the old entity
  // (with its own captured draft and store) before the new session exists.
  useEffect(() => {
    const session: Session = {
      kind,
      id,
      store,
      toPatch,
      initial: initialDraft,
      initialKey: JSON.stringify(initialDraft),
      draft: initialDraft,
      savedBase: null,
      inFlight: null,
      pending: false,
      paused: false,
      failed: false,
      lastPatch: {},
      lastSentDraft: initialDraft,
    };
    sessionRef.current = session;
    setEditing(false);
    setState('idle');
    setError(undefined);
    setDirty(false);
    return () => {
      session.pending = false;
      void flush(session);
    };
    // Only an entity switch or unmount ends a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.store = store;
    session.toPatch = toPatch;
    session.initial = initialDraft;
    const key = JSON.stringify(initialDraft);
    if (key !== session.initialKey) {
      session.initialKey = key;
      session.savedBase = null;
    }
  });

  useEffect(() => {
    if (!commitRequested.current) return;
    commitRequested.current = false;
    const session = sessionRef.current;
    if (session) requestSave(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitTick]);

  useEffect(() => {
    if (!dirty && state !== 'saving') return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, state]);

  const setDraft = (next: Draft) => {
    const session = sessionRef.current;
    if (session) {
      session.draft = next;
      refreshDirty(session);
    }
    setDraftState(next);
  };

  const commit = useCallback(() => {
    commitRequested.current = true;
    setCommitTick((tick) => tick + 1);
  }, []);

  const startEditing = () => {
    const session = sessionRef.current;
    if (session) {
      session.draft = initialDraft;
      session.savedBase = null;
      session.paused = false;
      session.failed = false;
    }
    setDraftState(initialDraft);
    setDirty(false);
    setState('idle');
    setError(undefined);
    setEditing(true);
  };

  const done = async () => {
    const session = sessionRef.current;
    if (!session) return;
    const clean = await flush(session);
    if (clean && live(session)) {
      setEditing(false);
      setState('idle');
    }
  };

  const reloadLatest = useCallback(async () => {
    await store.reload();
    const session = sessionRef.current;
    if (session) {
      session.paused = false;
      session.failed = false;
      session.pending = false;
      session.savedBase = null;
    }
    setEditing(false);
    setState('idle');
    setError(undefined);
    setDirty(false);
  }, [store]);

  // The store already refetched the authoritative object on conflict, so
  // re-sending the same patch now carries the fresh revision.
  const keepMine = () => {
    const session = sessionRef.current;
    if (!session) return;
    session.paused = false;
    void attempt(session, session.lastPatch);
  };

  const saveOnBlur = () => {
    const session = sessionRef.current;
    if (session) requestSave(session);
  };

  let status: string | null = null;
  if (state === 'saving') status = 'Saving…';
  else if (dirty) status = 'Unsaved changes';
  else if (state === 'saved') status = 'Saved';

  return (
    <article aria-labelledby={headingId} className={styles.editable}>
      <header className={styles.header}>
        <h2 id={headingId}>{heading}</h2>
        {headerExtras}
        <div className={styles.actions}>
          {editing && status ? (
            <span className={styles.status} role="status">
              {status}
            </span>
          ) : null}
          {headerActions}
          {listPath ? (
            <RemoveItemButton
              id={id}
              kind={kind}
              label={typeof heading === 'string' ? heading : 'this item'}
              listPath={listPath}
            />
          ) : null}
          {store.editable ? (
            editing ? (
              <button onClick={() => void done()} type="button">
                Done
              </button>
            ) : (
              <button onClick={startEditing} type="button">
                Edit
              </button>
            )
          ) : null}
        </div>
      </header>
      <SaveBanner
        error={error}
        onKeepMine={keepMine}
        onReload={reloadLatest}
        state={state === 'conflict' || state === 'error' ? state : 'idle'}
      />
      {editing ? (
        <EditableCommitContext.Provider value={commit}>
          <form
            aria-label="Edit form"
            className={styles.form}
            onBlur={saveOnBlur}
            onChange={(event) => {
              // Selects and toggles commit on change; they keep focus after.
              const target = event.target as HTMLElement;
              if (
                target instanceof HTMLSelectElement ||
                (target instanceof HTMLInputElement &&
                  (target.type === 'checkbox' || target.type === 'radio'))
              ) {
                commit();
              }
            }}
            onSubmit={(event) => {
              event.preventDefault();
              saveOnBlur();
            }}
          >
            {renderForm(draft, setDraft)}
          </form>
        </EditableCommitContext.Provider>
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
