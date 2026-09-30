import { useEffect, useId, useRef, useState, type DragEvent } from 'react';

import type {
  CampaignNote,
  NoteColor,
  NoteSize,
} from '@/demo/fixture-registry';
import { diffDraft } from '@/features/section-shell/draftUtils';
import { SaveBanner } from '@/features/section-shell/EditableSection';
import type { SaveState } from '@/features/section-shell/bundleStore';
import { useSectionBundle } from '@/features/section-shell/SectionContext';

import { MarkdownBody } from './MarkdownBody';
import {
  NOTE_COLORS,
  NOTE_SIZES,
  anchorFromKey,
  anchorKey,
  anchorLabel,
  anchorOptions,
  moveToTarget,
  moveWithinView,
  nextNoteOrder,
  type NotesBoardModel,
} from './notesBoardModels';
import styles from './NotesBoard.module.css';

const COLOR_LABEL: Record<NoteColor, string> = {
  yellow: 'Yellow',
  pink: 'Pink',
  blue: 'Blue',
  green: 'Green',
  purple: 'Purple',
  orange: 'Orange',
  gray: 'Gray',
};

interface NoteFormProps {
  initial: {
    title: string;
    body: string;
    anchor: string;
    color: NoteColor;
    size: NoteSize;
  };
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: NoteFormProps['initial']) => void;
  onCancel: () => void;
  showAppearance: boolean;
  autoFocus?: boolean;
}

function NoteForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
  showAppearance,
  autoFocus,
}: NoteFormProps) {
  const { bundle } = useSectionBundle();
  const [draft, setDraft] = useState(initial);
  const id = useId();
  const options = anchorOptions(bundle);
  if (!options.some((option) => option.value === draft.anchor)) {
    options.push({
      value: draft.anchor,
      label: anchorLabel(bundle, anchorFromKey(draft.anchor)),
    });
  }
  return (
    <form
      aria-label={submitLabel === 'Add note' ? 'New note' : 'Edit note'}
      className={styles.form}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <label className={styles.srOnly} htmlFor={`${id}-title`}>
        Title
      </label>
      <input
        autoFocus={autoFocus}
        className={styles.titleInput}
        id={`${id}-title`}
        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        placeholder="Title"
        value={draft.title}
      />
      <label className={styles.srOnly} htmlFor={`${id}-body`}>
        Note body
      </label>
      <textarea
        className={styles.bodyInput}
        id={`${id}-body`}
        onChange={(event) => setDraft({ ...draft, body: event.target.value })}
        placeholder="Take a note… (supports **bold**, *italic*, - lists)"
        rows={5}
        value={draft.body}
      />
      <div className={styles.formRow}>
        <label htmlFor={`${id}-anchor`}>Anchor</label>
        <select
          id={`${id}-anchor`}
          onChange={(event) =>
            setDraft({ ...draft, anchor: event.target.value })
          }
          value={draft.anchor}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {showAppearance ? (
        <>
          <fieldset className={styles.colors}>
            <legend>Color</legend>
            {NOTE_COLORS.map((color) => (
              <label className={styles.swatchLabel} key={color}>
                <input
                  checked={draft.color === color}
                  className={styles.swatchInput}
                  name={`${id}-color`}
                  onChange={() => setDraft({ ...draft, color })}
                  type="radio"
                  value={color}
                />
                <span
                  className={styles.swatch}
                  data-color={color}
                  title={COLOR_LABEL[color]}
                />
                <span className={styles.srOnly}>{COLOR_LABEL[color]}</span>
              </label>
            ))}
          </fieldset>
          <div className={styles.formRow}>
            <label htmlFor={`${id}-size`}>Size</label>
            <select
              id={`${id}-size`}
              onChange={(event) =>
                setDraft({ ...draft, size: event.target.value as NoteSize })
              }
              value={draft.size}
            >
              {NOTE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size[0].toUpperCase() + size.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}
      <div className={styles.formActions}>
        <button disabled={busy} type="submit">
          {busy ? 'Saving…' : submitLabel === 'Add note' ? 'Add note' : 'Save'}
        </button>
        <button disabled={busy} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}

function TakeNote({ nextOrder }: { nextOrder: number }) {
  const { store } = useSectionBundle();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!store.editable) return null;

  if (!open) {
    return (
      <div className={`${styles.card} ${styles.take}`} data-color="gray">
        <button
          className={styles.takeButton}
          onClick={() => setOpen(true)}
          type="button"
        >
          Take a note…
        </button>
      </div>
    );
  }
  return (
    <div className={`${styles.card} ${styles.take} ${styles.editing}`} data-color="yellow">
      <NoteForm
        autoFocus
        busy={busy}
        initial={{
          title: '',
          body: '',
          anchor: 'campaign',
          color: 'yellow',
          size: 'small',
        }}
        onCancel={() => {
          setOpen(false);
          setError(undefined);
        }}
        onSubmit={async (values) => {
          if (!values.title.trim() && !values.body.trim()) {
            setError('Write a title or some text first.');
            return;
          }
          setBusy(true);
          setError(undefined);
          const result = await store.addItem('note', {
            title: values.title.trim(),
            body: values.body,
            anchor: anchorFromKey(values.anchor),
            color: values.color,
            size: values.size,
            order: nextOrder,
          });
          setBusy(false);
          if (result.ok) setOpen(false);
          else setError(result.error ?? 'Could not add the note.');
        }}
        showAppearance
        submitLabel="Add note"
      />
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface NoteCardProps {
  note: CampaignNote;
  position: number;
  total: number;
  selected: boolean;
  dragging: boolean;
  onMove: (delta: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}

function NoteCard({
  note,
  position,
  total,
  selected,
  dragging,
  onMove,
  onDragStart,
  onDragEnd,
  onDrop,
}: NoteCardProps) {
  const { bundle, store } = useSectionBundle();
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string>();
  const ref = useRef<HTMLElement>(null);
  const title = note.title || 'Untitled note';
  const editable = store.editable;

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);

  const initial = {
    title: note.title,
    body: note.body,
    anchor: anchorKey(note.anchor),
    color: note.color,
    size: note.size,
  };

  const save = async (values: typeof initial) => {
    const patch = diffDraft(
      { ...values, anchor: anchorFromKey(values.anchor) },
      { ...initial, anchor: note.anchor },
    );
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    setState('saving');
    setError(undefined);
    const result = await store.updateItem('note', note.id, patch);
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

  const dragProps = editable && !editing
    ? {
        draggable: true,
        onDragStart: (event: DragEvent) => {
          event.dataTransfer?.setData?.('text/plain', note.id);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
          onDragStart();
        },
        onDragEnd,
        onDragOver: (event: DragEvent) => event.preventDefault(),
        onDrop: (event: DragEvent) => {
          event.preventDefault();
          onDrop();
        },
      }
    : {};

  return (
    <article
      aria-label={`Note: ${title}`}
      aria-current={selected ? 'true' : undefined}
      className={`${styles.card} ${styles[note.size]} ${editing ? styles.editing : ''} ${dragging ? styles.dragging : ''}`}
      data-color={note.color}
      data-size={note.size}
      ref={ref}
      {...dragProps}
    >
      {editing ? (
        <>
          <NoteForm
            autoFocus
            busy={state === 'saving'}
            initial={initial}
            onCancel={() => {
              setEditing(false);
              setState('idle');
              setError(undefined);
            }}
            onSubmit={(values) => void save(values)}
            showAppearance
            submitLabel="Save"
          />
          <SaveBanner
            error={error}
            onReload={() => {
              void store.reload();
              setEditing(false);
              setState('idle');
            }}
            state={state}
          />
        </>
      ) : (
        <>
          {editable ? (
            <button
              aria-label={`Edit note: ${title}`}
              className={styles.open}
              onClick={() => setEditing(true)}
              type="button"
            >
              <span className={styles.cardTitle}>{title}</span>
              <MarkdownBody className={styles.clip} source={note.body} />
            </button>
          ) : (
            <div className={styles.open}>
              <h3 className={styles.cardTitle}>{title}</h3>
              <MarkdownBody className={styles.clip} source={note.body} />
            </div>
          )}
          <footer className={styles.cardFooter}>
            <span className={styles.chip}>
              {anchorLabel(bundle, note.anchor)}
            </span>
            {editable ? (
              <span className={styles.moves}>
                <button
                  aria-label={`Move earlier: ${title}`}
                  disabled={position === 0}
                  onClick={() => onMove(-1)}
                  type="button"
                >
                  ←
                </button>
                <button
                  aria-label={`Move later: ${title}`}
                  disabled={position === total - 1}
                  onClick={() => onMove(1)}
                  type="button"
                >
                  →
                </button>
              </span>
            ) : null}
          </footer>
          {state === 'saved' ? <SaveBanner state={state} /> : null}
        </>
      )}
    </article>
  );
}

interface NotesBoardProps {
  model: NotesBoardModel;
  selectedId?: string;
}

export function NotesBoard({ model, selectedId }: NotesBoardProps) {
  const { store } = useSectionBundle();
  const [dragId, setDragId] = useState<string>();
  const [announcement, setAnnouncement] = useState('');
  const [error, setError] = useState<string>();
  const allIds = model.all.map((note) => note.id);
  const visibleIds = model.visible.map((note) => note.id);

  const commit = async (next: string[], id: string) => {
    if (next.join('|') === allIds.join('|')) return;
    setError(undefined);
    const result = await store.reorderNotes(next);
    const note = model.all.find((item) => item.id === id);
    const label = note?.title || 'Untitled note';
    if (result.ok) {
      const nextVisible = next.filter((item) => visibleIds.includes(item));
      setAnnouncement(
        `Moved ${label} to position ${nextVisible.indexOf(id) + 1} of ${nextVisible.length}.`,
      );
    } else {
      setError(result.error ?? 'Could not save the new order.');
      setAnnouncement(`Could not move ${label}.`);
    }
  };

  return (
    <div className={styles.board}>
      <div aria-live="polite" className={styles.srOnly} role="status">
        {announcement}
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.grid} role="list">
        {store.editable ? (
          <div className={styles.cell} data-size="small" role="listitem">
            <TakeNote nextOrder={nextNoteOrder(model.all)} />
          </div>
        ) : null}
        {model.visible.map((note, index) => (
          <div className={styles.cell} data-size={note.size} key={note.id} role="listitem">
            <NoteCard
              dragging={dragId === note.id}
              note={note}
              onDragEnd={() => setDragId(undefined)}
              onDragStart={() => setDragId(note.id)}
              onDrop={() => {
                if (dragId) {
                  void commit(
                    moveToTarget(allIds, visibleIds, dragId, note.id),
                    dragId,
                  );
                }
                setDragId(undefined);
              }}
              onMove={(delta) =>
                void commit(
                  moveWithinView(allIds, visibleIds, note.id, delta),
                  note.id,
                )
              }
              position={index}
              selected={selectedId === note.id}
              total={model.visible.length}
            />
          </div>
        ))}
      </div>
      {model.visible.length === 0 ? (
        <p className={styles.empty}>
          {model.all.length === 0
            ? store.editable
              ? 'No notes yet. Use “Take a note…” to start.'
              : 'This campaign has no notes.'
            : 'No notes match this filter.'}
        </p>
      ) : null}
    </div>
  );
}
