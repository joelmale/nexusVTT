import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import type { CampaignNote } from '@/demo/fixture-registry';
import { MentionChip } from '@/features/mentions/MentionText';
import { MentionTextarea } from '@/features/mentions/MentionTextarea';
import { EmptyState } from '@/features/section-shell/EmptyState';
import {
  AddRow,
  EditableSection,
} from '@/features/section-shell/EditableSection';
import { EntityList } from '@/features/section-shell/EntityList';
import { FilterBar } from '@/features/section-shell/FilterBar';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionLayout } from '@/features/section-shell/SectionLayout';
import { SectionSummary } from '@/features/section-shell/SectionSummary';
import { StatusBadge } from '@/features/section-shell/StatusBadge';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';

import { MarkdownBody } from './MarkdownBody';
import styles from './NotesSection.module.css';
import {
  anchorFromKey,
  anchorLabel,
  anchorOptions,
  audienceSummary,
  buildNotesModel,
  isShared,
  noteDraftToPatch,
  noteToDraft,
  type NoteDraft,
  type NoteRow,
  type ShareMode,
} from './notesModels';

function NoteRowContent({ row }: { row: NoteRow }) {
  return (
    <>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{row.title}</span>
        {row.preview ? (
          <span className={styles.rowPreview}>{row.preview}</span>
        ) : null}
      </span>
      <span className={styles.anchorChip}>{row.anchorLabel}</span>
      {row.shared ? <StatusBadge tone="info">Shared</StatusBadge> : null}
    </>
  );
}

function NoteDetail({ note }: { note: CampaignNote }) {
  const { bundle } = useSectionBundle();
  const characters = bundle.catalog.playerCharacters ?? [];
  const draft = useMemo(() => noteToDraft(note), [note]);
  const shared = isShared(note);

  const options = anchorOptions(bundle);
  const optionsFor = (selected: string) =>
    options.some((option) => option.value === selected)
      ? options
      : [
          ...options,
          {
            value: selected,
            label: anchorLabel(bundle, anchorFromKey(selected)),
          },
        ];

  return (
    <EditableSection
      heading={note.title}
      id={note.id}
      initialDraft={draft as unknown as Record<string, unknown>}
      kind="note"
      renderForm={(current, setDraft) => {
        const value = current as unknown as NoteDraft;
        const update = (next: Partial<NoteDraft>) =>
          setDraft({ ...value, ...next } as unknown as Record<string, unknown>);
        return (
          <>
            <label>
              Title
              <input
                onChange={(event) => update({ title: event.target.value })}
                value={value.title}
              />
            </label>
            <label>
              Note
              <MentionTextarea
                className={styles.bodyInput}
                onChange={(body) => update({ body })}
                placeholder="Write your note (supports **bold**, *italic*, - lists, and @ to mention anything in the campaign)"
                rows={10}
                value={value.body}
              />
            </label>
            <label>
              Anchor
              <select
                onChange={(event) => update({ anchor: event.target.value })}
                value={value.anchor}
              >
                {optionsFor(value.anchor).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Share with players
              <select
                onChange={(event) =>
                  update({ share: event.target.value as ShareMode })
                }
                value={value.share}
              >
                <option value="none">Private</option>
                <option value="all">All players</option>
                <option value="selected">Selected characters</option>
              </select>
            </label>
            {value.share === 'selected' ? (
              <fieldset className={styles.characters}>
                <legend>Characters</legend>
                {characters.length === 0 ? (
                  <p className={styles.empty}>No player characters yet.</p>
                ) : (
                  characters.map((character) => (
                    <label key={character.id}>
                      <input
                        checked={value.characterIds.includes(character.id)}
                        onChange={(event) =>
                          update({
                            characterIds: event.target.checked
                              ? [...value.characterIds, character.id]
                              : value.characterIds.filter(
                                  (id) => id !== character.id,
                                ),
                          })
                        }
                        type="checkbox"
                      />
                      {character.name}
                    </label>
                  ))
                )}
              </fieldset>
            ) : null}
          </>
        );
      }}
      toPatch={(current, initial) =>
        noteDraftToPatch(
          current as unknown as NoteDraft,
          initial as unknown as NoteDraft,
        )
      }
    >
      <p className={styles.meta}>{anchorLabel(bundle, note.anchor)}</p>
      {shared ? (
        <p className={styles.sharedNote} role="note">
          <strong>Shared with players.</strong>{' '}
          {audienceSummary(note.audience, characters)}. This note is visible to
          players as a handout.
        </p>
      ) : null}
      {note.body.trim() ? (
        <MarkdownBody
          renderMention={(id, label) => <MentionChip id={id} label={label} />}
          source={note.body}
        />
      ) : (
        <p className={styles.empty}>Nothing written yet.</p>
      )}
    </EditableSection>
  );
}

export function NotesSection() {
  const { bundle, basePath, store } = useSectionBundle();
  const { noteId } = useParams<{ noteId?: string }>();
  const { get } = useSectionQuery();

  const model = useMemo(
    () => buildNotesModel(bundle, { q: get('q'), anchor: get('anchor') }),
    [bundle, get],
  );

  const selected = noteId
    ? bundle.notes.find((note) => note.id === noteId)
    : undefined;
  const readOnlyEmpty = model.total === 0 && !store.editable;

  const list =
    model.total === 0 ? (
      <p className={styles.emptyList}>No notes yet.</p>
    ) : model.rows.length === 0 ? (
      <p className={styles.emptyList}>No notes match these filters.</p>
    ) : (
      <EntityList
        ariaLabel="Note list"
        getHref={(row) => `${basePath}/notes/${encodeURIComponent(row.id)}`}
        getId={(row) => row.id}
        groups={[{ id: 'notes', items: model.rows }]}
        renderRow={(row) => <NoteRowContent row={row} />}
        selectedId={noteId}
      />
    );

  return (
    <SectionLayout
      count={model.total}
      detail={selected ? <NoteDetail note={selected} /> : undefined}
      empty={
        readOnlyEmpty ? (
          <EmptyState
            description="Notes you add will appear here."
            title="No notes yet."
          />
        ) : undefined
      }
      filters={
        <FilterBar
          facets={[
            {
              key: 'anchor',
              label: 'Show',
              allLabel: 'All',
              options: model.anchorOptions,
            },
          ]}
          plural="notes"
          resultCount={model.rows.length}
          searchLabel="Search notes"
          singular="note"
        />
      }
      list={list}
      listFooter={
        <AddRow
          defaults={{
            anchor: anchorFromKey(get('anchor')),
            audience: 'none',
            body: '',
          }}
          kind="note"
          label="Add note"
          nameField="title"
          sectionPath="notes"
        />
      }
      notFound={Boolean(noteId) && !selected}
      sectionPath="notes"
      selectedId={noteId}
      summary={
        <SectionSummary
          stats={[
            { label: 'Notes', value: model.total },
            {
              label: 'Shared',
              value: bundle.notes.filter(isShared).length,
            },
          ]}
          title="Notes overview"
        >
          <p className={styles.hint}>
            Select a note to read it. Notes are private unless you share them
            with players.
          </p>
        </SectionSummary>
      }
      title="Notes"
    />
  );
}
