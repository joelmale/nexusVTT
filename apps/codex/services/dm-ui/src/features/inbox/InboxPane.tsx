import { useState } from 'react';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import CheckSquare from 'lucide-react/dist/esm/icons/check-square';
import Inbox from 'lucide-react/dist/esm/icons/inbox';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import UserRound from 'lucide-react/dist/esm/icons/user-round';

import type { InboxNote } from '@/demo/fixture-registry';
import { MentionText } from '@/features/mentions/MentionText';
import { FilterBar, type FilterFacet } from '@/features/section-shell/FilterBar';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';

import {
  computeInboxStats,
  describeTriageTarget,
  filterInboxNotes,
  formatInboxDate,
  isUnfiled,
  triageToNoteDraft,
  triageToNpcDraft,
  triageToQuestDraft,
  triageToSecretDraft,
  type InboxFilterOptions,
} from './inboxModel';
import { QuickCaptureModal } from './QuickCaptureModal';
import styles from './InboxPane.module.css';

export interface InboxPaneProps {
  className?: string;
}

export function InboxPane({ className }: InboxPaneProps) {
  const { bundle, store } = useSectionBundle();
  const { get } = useSectionQuery();

  const [isQuickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [triagingNoteId, setTriagingNoteId] = useState<string | null>(null);
  const [partialTriage, setPartialTriage] = useState<
    Record<string, { kind: string; id: string }>
  >({});
  const [triageError, setTriageError] = useState<{
    noteId: string;
    message: string;
  } | null>(null);

  const rawNotes = bundle.inboxNotes ?? [];
  const stats = computeInboxStats(rawNotes);

  const queryParam = get('q') || undefined;
  const statusParam = (get('status') as InboxFilterOptions['status']) || 'all';

  const filteredNotes = filterInboxNotes(rawNotes, {
    query: queryParam,
    status: statusParam,
  });

  const facets: FilterFacet[] = [
    {
      key: 'status',
      label: 'Status',
      allLabel: 'All notes',
      options: [
        { value: 'unfiled', label: 'Unfiled', count: stats.unfiled },
        { value: 'triaged', label: 'Triaged', count: stats.triaged },
      ],
    },
  ];

  const handleTriage = async (
    note: InboxNote,
    target: 'npc' | 'quest' | 'secret' | 'note',
  ) => {
    if (!store.editable || triagingNoteId) return;

    try {
      setTriagingNoteId(note.id);
      setTriageError(null);

      // Step 1: Reuse existing targetId if partial failure occurred previously
      let targetId =
        partialTriage[note.id]?.kind === target
          ? partialTriage[note.id].id
          : undefined;

      if (!targetId) {
        let draft: Record<string, unknown>;
        if (target === 'npc') {
          draft = triageToNpcDraft(note.text);
        } else if (target === 'quest') {
          draft = triageToQuestDraft(note.text);
        } else if (target === 'secret') {
          draft = triageToSecretDraft(note.text);
        } else {
          draft = triageToNoteDraft(note.text);
        }

        try {
          const res = await store.addItem(target, draft);
          if (!res || res.ok === false || !res.id) {
            setTriageError({
              noteId: note.id,
              message: `Failed to create ${target}. Please retry.`,
            });
            return;
          }
          targetId = res.id;
          setPartialTriage((prev) => ({
            ...prev,
            [note.id]: { kind: target, id: targetId! },
          }));
        } catch (err) {
          setTriageError({
            noteId: note.id,
            message:
              err instanceof Error
                ? err.message
                : `Failed to create ${target}. Please retry.`,
          });
          return;
        }
      }

      // Step 2: Update the inbox note triage reference
      try {
        const updateRes = await store.updateItem('inbox-note', note.id, {
          triagedTo: { kind: target, id: targetId },
        });
        if (!updateRes || updateRes.ok === false) {
          setTriageError({
            noteId: note.id,
            message: `Created ${target}, but failed to update note status. Retry to complete triage.`,
          });
          return;
        }
      } catch (err) {
        setTriageError({
          noteId: note.id,
          message:
            err instanceof Error
              ? err.message
              : `Created ${target}, but failed to update note status. Retry to complete triage.`,
        });
        return;
      }

      // Clean up on complete success
      setPartialTriage((prev) => {
        const next = { ...prev };
        delete next[note.id];
        return next;
      });
      setTriageError(null);
    } finally {
      setTriagingNoteId(null);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!store.editable) return;
    await store.removeItem('inbox-note', noteId);
  };

  return (
    <div
      className={`${styles.pane} ${className ?? ''}`}
      data-testid="inbox-pane"
    >
      <div className={styles.statsBar}>
        <div className={styles.statGroup}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.unfiled}</span>
            <span className={styles.statLabel}>Unfiled</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.triaged}</span>
            <span className={styles.statLabel}>Triaged</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>Total Captured</span>
          </div>
        </div>

        {store.editable ? (
          <button
            className={styles.newNoteBtn}
            onClick={() => setQuickCaptureOpen(true)}
            type="button"
          >
            <Plus size={16} />
            <span>New Note</span>
          </button>
        ) : null}
      </div>

      {triageError ? (
        <div className={styles.errorAlert} role="alert">
          {triageError.message}
        </div>
      ) : null}

      <FilterBar
        facets={facets}
        plural="notes"
        resultCount={filteredNotes.length}
        searchLabel="Search inbox notes"
        singular="note"
      />

      {filteredNotes.length === 0 ? (
        <div className={styles.emptyState}>
          <Inbox className={styles.emptyIcon} size={36} />
          <h3 className={styles.emptyTitle}>No inbox notes found</h3>
          <p className={styles.emptyDesc}>
            {rawNotes.length === 0
              ? 'Use Quick Capture (Ctrl+Shift+N) from anywhere in Studio to capture ideas without losing your place.'
              : 'Try clearing your filters or search term to see more notes.'}
          </p>
          {rawNotes.length === 0 && store.editable ? (
            <button
              className={styles.newNoteBtn}
              onClick={() => setQuickCaptureOpen(true)}
              type="button"
            >
              <Plus size={16} />
              <span>Capture First Note</span>
            </button>
          ) : null}
        </div>
      ) : (
        <ul className={styles.noteList}>
          {filteredNotes.map((note) => {
            const unfiled = isUnfiled(note);
            const isBusy = triagingNoteId === note.id;

            return (
              <li className={styles.noteCard} key={note.id}>
                <div className={styles.noteHeader}>
                  <div className={styles.badges}>
                    {unfiled ? (
                      <span className={styles.unfiledBadge}>Unfiled</span>
                    ) : (
                      <span className={styles.triagedBadge}>
                        {describeTriageTarget(note.triagedTo!, bundle)}
                      </span>
                    )}
                  </div>
                  <span className={styles.date}>
                    {formatInboxDate(note.createdAt)}
                  </span>
                </div>

                <div className={styles.noteBody}>
                  <MentionText text={note.text} />
                </div>

                <div className={styles.cardFooter}>
                  {store.editable ? (
                    <div className={styles.triageActions}>
                      <span className={styles.triageLabel}>
                        {unfiled ? 'Triage to:' : 'Convert to:'}
                      </span>
                      <button
                        className={styles.triageBtn}
                        disabled={isBusy}
                        onClick={() => void handleTriage(note, 'npc')}
                        title="Create an NPC draft from this note"
                        type="button"
                      >
                        <UserRound size={12} />
                        <span>NPC</span>
                      </button>
                      <button
                        className={styles.triageBtn}
                        disabled={isBusy}
                        onClick={() => void handleTriage(note, 'quest')}
                        title="Create a Quest draft from this note"
                        type="button"
                      >
                        <CheckSquare size={12} />
                        <span>Quest</span>
                      </button>
                      <button
                        className={styles.triageBtn}
                        disabled={isBusy}
                        onClick={() => void handleTriage(note, 'secret')}
                        title="Create a Secret draft from this note"
                        type="button"
                      >
                        <Sparkles size={12} />
                        <span>Secret</span>
                      </button>
                      <button
                        className={styles.triageBtn}
                        disabled={isBusy}
                        onClick={() => void handleTriage(note, 'note')}
                        title="Convert to a permanent Campaign Note"
                        type="button"
                      >
                        <BookOpen size={12} />
                        <span>Note</span>
                      </button>
                    </div>
                  ) : <div />}

                  {store.editable ? (
                    <button
                      aria-label="Delete note"
                      className={styles.deleteBtn}
                      disabled={isBusy}
                      onClick={() => void handleDelete(note.id)}
                      title="Delete note"
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isQuickCaptureOpen ? (
        <QuickCaptureModal
          isOpen={isQuickCaptureOpen}
          onClose={() => setQuickCaptureOpen(false)}
        />
      ) : null}
    </div>
  );
}
