import { useId, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import type { CampaignHandout } from '@/demo/fixture-registry';
import {
  AddRow,
  EditableSection,
} from '@/features/section-shell/EditableSection';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { FilterBar } from '@/features/section-shell/FilterBar';
import { SectionLayout } from '@/features/section-shell/SectionLayout';
import { SectionSummary } from '@/features/section-shell/SectionSummary';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';

import {
  UNFILED_ID,
  audienceIds,
  audienceMode,
  audienceSummary,
  buildAudience,
  buildHandoutGroups,
  handoutBody,
  handoutFolders,
  moveHandoutPatches,
  nextFolderOrder,
  nextHandoutOrder,
  playerHandouts,
  type AudienceMode,
  type HandoutGroup,
} from './handoutsModels';
import styles from './HandoutsTab.module.css';
import { MarkdownBody } from './MarkdownBody';

function FolderHeader({ group }: { group: HandoutGroup }) {
  const { store } = useSectionBundle();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(group.label);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const canRename = store.editable && group.folder;

  if (editing && group.folder) {
    const folder = group.folder;
    return (
      <form
        aria-label={`Rename folder ${group.label}`}
        className={styles.folderForm}
        onSubmit={async (event) => {
          event.preventDefault();
          const title = value.trim();
          if (!title) {
            setError('Enter a folder name.');
            return;
          }
          if (title === folder.title) {
            setEditing(false);
            return;
          }
          setBusy(true);
          const result = await store.updateItem('handout-folder', folder.id, {
            title,
          });
          setBusy(false);
          if (result.ok) {
            setEditing(false);
            setError(undefined);
          } else setError(result.error ?? 'Could not rename.');
        }}
      >
        <label className={styles.srOnly} htmlFor={inputId}>
          Folder name
        </label>
        <input
          autoFocus
          id={inputId}
          onChange={(event) => setValue(event.target.value)}
          value={value}
        />
        <button disabled={busy} type="submit">
          Save
        </button>
        <button
          disabled={busy}
          onClick={() => {
            setEditing(false);
            setValue(group.label);
            setError(undefined);
          }}
          type="button"
        >
          Cancel
        </button>
        {error ? (
          <span className={styles.error} role="alert">
            {error}
          </span>
        ) : null}
      </form>
    );
  }
  return (
    <div className={styles.folderHeader}>
      <h3>{group.label}</h3>
      <span className={styles.folderCount}>{group.items.length}</span>
      {canRename ? (
        <button
          aria-label={`Rename folder ${group.label}`}
          onClick={() => {
            setValue(group.label);
            setEditing(true);
          }}
          type="button"
        >
          Rename
        </button>
      ) : null}
    </div>
  );
}

function NewFolder() {
  const { store, bundle } = useSectionBundle();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inputId = useId();
  if (!store.editable) return null;
  if (!open) {
    return (
      <button
        className={styles.newFolder}
        onClick={() => setOpen(true)}
        type="button"
      >
        + New folder
      </button>
    );
  }
  return (
    <form
      aria-label="New folder"
      className={styles.folderForm}
      onSubmit={async (event) => {
        event.preventDefault();
        const title = value.trim();
        if (!title) {
          setError('Enter a folder name.');
          return;
        }
        setBusy(true);
        const result = await store.addItem('handout-folder', {
          title,
          order: nextFolderOrder(handoutFolders(bundle)),
        });
        setBusy(false);
        if (result.ok) {
          setOpen(false);
          setValue('');
          setError(undefined);
        } else setError(result.error ?? 'Could not create the folder.');
      }}
    >
      <label className={styles.srOnly} htmlFor={inputId}>
        New folder name
      </label>
      <input
        autoFocus
        id={inputId}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Folder name"
        value={value}
      />
      <button disabled={busy} type="submit">
        Create
      </button>
      <button
        disabled={busy}
        onClick={() => {
          setOpen(false);
          setValue('');
          setError(undefined);
        }}
        type="button"
      >
        Cancel
      </button>
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}

function HandoutRow({
  handout,
  index,
  total,
  selected,
  href,
  onMove,
  announce,
}: {
  handout: CampaignHandout;
  index: number;
  total: number;
  selected: boolean;
  href: string;
  onMove: (delta: number) => void;
  announce: string;
}) {
  const { store, bundle } = useSectionBundle();
  return (
    <li className={styles.row}>
      <Link
        aria-current={selected ? 'page' : undefined}
        className={`${styles.link} ${selected ? styles.selected : ''}`}
        to={href}
      >
        <span className={styles.rowTitle}>{handout.title}</span>
        <span className={styles.rowMeta}>
          {audienceSummary(
            handout.audience,
            bundle.catalog.playerCharacters ?? [],
          )}
        </span>
      </Link>
      {store.editable ? (
        <span className={styles.moves} title={announce}>
          <button
            aria-label={`Move ${handout.title} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            type="button"
          >
            ↑
          </button>
          <button
            aria-label={`Move ${handout.title} down`}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            type="button"
          >
            ↓
          </button>
        </span>
      ) : null}
    </li>
  );
}

interface HandoutsTabProps {
  tabs: ReactNode;
  selectedId?: string;
}

interface Draft {
  title: string;
  body: string;
  folderId: string;
  mode: AudienceMode;
  ids: string[];
}

export function HandoutsTab({ tabs, selectedId }: HandoutsTabProps) {
  const { bundle, basePath, store } = useSectionBundle();
  const { get } = useSectionQuery();
  const { search } = useLocation();
  const [announcement, setAnnouncement] = useState('');
  const [moveError, setMoveError] = useState<string>();
  const characters = bundle.catalog.playerCharacters ?? [];
  const folders = handoutFolders(bundle);
  const all = playerHandouts(bundle);
  const groups = buildHandoutGroups(bundle, get('q'));
  const visibleCount = groups.reduce((n, g) => n + g.items.length, 0);
  const selected = selectedId
    ? all.find((handout) => handout.id === selectedId)
    : undefined;

  const move = async (group: HandoutGroup, id: string, delta: number) => {
    const patches = moveHandoutPatches(group.items, id, delta);
    if (patches.length === 0) return;
    setMoveError(undefined);
    for (const patch of patches) {
      const result = await store.updateItem('handout', patch.id, {
        order: patch.order,
      });
      if (!result.ok) {
        setMoveError(result.error ?? 'Could not save the new order.');
        setAnnouncement('Could not reorder the handout.');
        return;
      }
    }
    const handout = group.items.find((item) => item.id === id);
    const from = group.items.findIndex((item) => item.id === id);
    setAnnouncement(
      `Moved ${handout?.title ?? 'handout'} to position ${from + delta + 1} of ${group.items.length} in ${group.label}.`,
    );
  };

  const list = (
    <div className={styles.list}>
      <NewFolder />
      <nav aria-label="Handout list">
        {groups.map((group) => (
          <section className={styles.group} key={group.id}>
            {group.id === UNFILED_ID ? (
              <div className={styles.folderHeader}>
                <h3>{group.label}</h3>
                <span className={styles.folderCount}>{group.items.length}</span>
              </div>
            ) : (
              <FolderHeader group={group} />
            )}
            {group.items.length === 0 ? (
              <p className={styles.emptyGroup}>No handouts in this folder.</p>
            ) : (
              <ul>
                {group.items.map((handout, index) => (
                  <HandoutRow
                    announce={announcement}
                    handout={handout}
                    href={`${basePath}/lore/handouts/${encodeURIComponent(handout.id)}${search}`}
                    index={index}
                    key={handout.id}
                    onMove={(delta) => void move(group, handout.id, delta)}
                    selected={handout.id === selectedId}
                    total={group.items.length}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </nav>
      <div aria-live="polite" className={styles.srOnly} role="status">
        {announcement}
      </div>
      {moveError ? (
        <p className={styles.error} role="alert">
          {moveError}
        </p>
      ) : null}
    </div>
  );

  const detail = selected ? (
    <HandoutDetail
      characters={characters}
      folders={folders.map((f) => ({ id: f.id, title: f.title }))}
      handout={selected}
    />
  ) : null;

  const empty =
    all.length === 0 && folders.length === 0 && !store.editable ? (
      <EmptyState
        description="Player-facing handouts for this campaign will appear here."
        title="No handouts"
      />
    ) : undefined;

  return (
    <SectionLayout
      count={all.length}
      detail={detail}
      empty={empty}
      filters={
        <FilterBar
          plural="handouts"
          resultCount={visibleCount}
          searchLabel="Search handouts"
          singular="handout"
        />
      }
      list={list}
      listFooter={
        <AddRow
          defaults={{
            audience: 'hidden',
            body: '',
            order: nextHandoutOrder(all),
          }}
          kind="handout"
          label="Add handout"
          nameField="title"
          sectionPath="lore/handouts"
        />
      }
      notFound={Boolean(selectedId) && !selected}
      sectionPath="lore/handouts"
      selectedId={selectedId}
      summary={
        <SectionSummary
          stats={[
            { label: 'Handouts', value: all.length },
            {
              label: 'Shared',
              value: all.filter((h) => audienceMode(h.audience) !== 'hidden')
                .length,
            },
            { label: 'Folders', value: folders.length },
          ]}
          title="Handouts"
        >
          <p>
            Select a handout to read it
            {store.editable ? ', edit it, or choose who sees it.' : '.'}
          </p>
        </SectionSummary>
      }
      tabs={tabs}
      title="Lore"
    />
  );
}

function HandoutDetail({
  handout,
  folders,
  characters,
}: {
  handout: CampaignHandout;
  folders: Array<{ id: string; title: string }>;
  characters: ReadonlyArray<{ id: string; name: string }>;
}) {
  const folder = folders.find((f) => f.id === handout.folderId);
  const initial: Draft = {
    title: handout.title,
    body: handoutBody(handout),
    folderId: folder?.id ?? '',
    mode: audienceMode(handout.audience),
    ids: audienceIds(handout.audience),
  };
  return (
    <EditableSection
      heading={handout.title}
      id={handout.id}
      initialDraft={initial as unknown as Record<string, unknown>}
      kind="handout"
      renderForm={(raw, setRaw) => {
        const draft = raw as unknown as Draft;
        const set = (next: Partial<Draft>) =>
          setRaw({ ...draft, ...next } as unknown as Record<string, unknown>);
        return (
          <>
            <label>
              Title
              <input
                onChange={(event) => set({ title: event.target.value })}
                value={draft.title}
              />
            </label>
            <label>
              Body (markdown: **bold**, *italic*, - lists)
              <textarea
                onChange={(event) => set({ body: event.target.value })}
                rows={10}
                value={draft.body}
              />
            </label>
            <label>
              Folder
              <select
                onChange={(event) => set({ folderId: event.target.value })}
                value={draft.folderId}
              >
                <option value="">Unfiled</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Share with
              <select
                onChange={(event) =>
                  set({ mode: event.target.value as AudienceMode })
                }
                value={draft.mode}
              >
                <option value="hidden">Hidden (DM only)</option>
                <option value="all">All players</option>
                <option value="selected">Selected player characters</option>
              </select>
            </label>
            {draft.mode === 'selected' ? (
              <fieldset className={styles.pcs}>
                <legend>Player characters</legend>
                {characters.length === 0 ? (
                  <p>This campaign has no player characters yet.</p>
                ) : (
                  characters.map((pc) => (
                    <label className={styles.check} key={pc.id}>
                      <input
                        checked={draft.ids.includes(pc.id)}
                        onChange={(event) =>
                          set({
                            ids: event.target.checked
                              ? [...draft.ids, pc.id]
                              : draft.ids.filter((id) => id !== pc.id),
                          })
                        }
                        type="checkbox"
                      />
                      {pc.name}
                    </label>
                  ))
                )}
              </fieldset>
            ) : null}
          </>
        );
      }}
      toPatch={(raw) => {
        const draft = raw as unknown as Draft;
        const patch: Record<string, unknown> = {};
        if (draft.title.trim() && draft.title !== initial.title) {
          patch.title = draft.title.trim();
        }
        if (draft.body !== initial.body) patch.body = draft.body;
        if (draft.folderId !== initial.folderId) {
          patch.folderId = draft.folderId || undefined;
        }
        const audience = buildAudience(draft.mode, draft.ids);
        if (JSON.stringify(audience) !== JSON.stringify(handout.audience)) {
          patch.audience = audience;
        }
        return patch;
      }}
    >
      <p className={styles.meta}>
        {audienceSummary(handout.audience, characters)}
        {' · '}
        {folder ? `Folder: ${folder.title}` : 'Unfiled'}
      </p>
      <MarkdownBody source={handoutBody(handout)} />
    </EditableSection>
  );
}
