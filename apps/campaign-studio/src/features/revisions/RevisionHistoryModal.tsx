import { useEffect, useMemo, useState } from 'react';
import History from 'lucide-react/dist/esm/icons/history';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import X from 'lucide-react/dist/esm/icons/x';

import type { EditableKind } from '@/features/section-shell/bundleStore';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { fetchObjectRevisions } from '@/services/campaign-bundle-api';
import styles from './RevisionHistoryModal.module.css';
import {
  computeDiff,
  formatRevisionDate,
  formatValue,
  generateSyntheticRevisions,
  restoreRevisionPatch,
  type ObjectRevision,
} from './revisionModel';

export interface RevisionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  objectId: string;
  kind: EditableKind;
  title: string;
  currentDraft: Record<string, unknown>;
  onRestore?: (restoredSnapshot: Record<string, unknown>) => void;
}

export function RevisionHistoryModal({
  isOpen,
  onClose,
  objectId,
  kind,
  title,
  currentDraft,
  onRestore,
}: RevisionHistoryModalProps) {
  const { bundle, store } = useSectionBundle();

  const [revisions, setRevisions] = useState<ObjectRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [retryCount, setRetryCount] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'diff' | 'raw'>('diff');
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setError(undefined);
    setLoadError(undefined);

    if (!store.editable) {
      setLoading(false);
      setRevisions(generateSyntheticRevisions(objectId, currentDraft));
      return () => {
        mounted = false;
      };
    }

    setLoading(true);

    async function load() {
      try {
        const fetched = await fetchObjectRevisions(bundle.campaignId, objectId);
        if (!mounted) return;

        if (fetched.length > 0) {
          const mapped: ObjectRevision[] = fetched.map((f) => ({
            revision: f.revision,
            createdAt: f.createdAt,
            createdBy: f.createdBy,
            snapshot:
              typeof f.snapshot === 'object' && f.snapshot !== null
                ? (f.snapshot as Record<string, unknown>)
                : { ...currentDraft },
            changeSummary: `Revision #${f.revision}`,
            synthetic: false,
          }));
          setRevisions(mapped);
        } else {
          setRevisions([]);
        }
      } catch {
        if (mounted) {
          setRevisions([]);
          setLoadError('Unable to load revision history from server.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [isOpen, store.editable, bundle.campaignId, objectId, currentDraft, retryCount]);

  const selectedRevision = revisions[selectedIndex] as ObjectRevision | undefined;
  const isCurrent = selectedIndex === 0;
  const canRestore = Boolean(
    selectedRevision &&
      !isCurrent &&
      store.editable &&
      !selectedRevision.synthetic,
  );

  const diffs = useMemo(() => {
    if (!selectedRevision) return [];
    return computeDiff(selectedRevision.snapshot, currentDraft);
  }, [selectedRevision, currentDraft]);

  const handleRestore = async () => {
    if (!selectedRevision || !store.editable || selectedRevision.synthetic) return;

    setRestoring(true);
    setError(undefined);

    try {
      const patch = restoreRevisionPatch(selectedRevision.snapshot, currentDraft);
      const result = await store.updateItem(kind, objectId, patch);
      if (!result.ok) {
        setError(result.error ?? 'Failed to restore revision.');
        setRestoring(false);
        return;
      }

      onRestore?.(selectedRevision.snapshot);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore revision.');
    } finally {
      setRestoring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      aria-label="Revision History Modal"
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        aria-labelledby="revision-modal-title"
        aria-modal="true"
        className={styles.modal}
        role="dialog"
      >
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <h2 className={styles.title} id="revision-modal-title">
              <History size={18} style={{ color: 'var(--studio-gold)', verticalAlign: 'text-bottom', marginRight: '8px' }} />
              Revision History: {title}
            </h2>
            <span className={styles.subtitle}>
              Inspect past edits, compare with the current version, and restore prior states
            </span>
          </div>
          <button
            aria-label="Close revision history"
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.content}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>Past Snapshots ({revisions.length})</div>
            {loading ? (
              <p className={styles.emptyState}>Loading revisions…</p>
            ) : (
              <ul className={styles.revisionList} role="list">
                {revisions.map((rev, idx) => {
                  const active = idx === selectedIndex;
                  return (
                    <li key={rev.revision}>
                      <button
                        aria-pressed={active}
                        className={`${styles.revisionItem} ${active ? styles.revisionItemActive : ''}`}
                        onClick={() => setSelectedIndex(idx)}
                        type="button"
                      >
                        <div className={styles.revisionItemTop}>
                          <span
                            className={`${styles.revPill} ${idx === 0 ? styles.currentPill : ''}`}
                          >
                            Rev #{rev.revision} {idx === 0 ? '(Current)' : ''}
                          </span>
                          <span className={styles.revDate}>
                            {formatRevisionDate(rev.createdAt)}
                          </span>
                        </div>
                        <span className={styles.revAuthor}>{rev.createdBy}</span>
                        {rev.changeSummary ? (
                          <span className={styles.revSummary}>{rev.changeSummary}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <main className={styles.inspector}>
            {selectedRevision ? (
              <>
                <div className={styles.inspectorTop}>
                  <div className={styles.inspectorTitleGroup}>
                    <h3 className={styles.inspectorHeading}>
                      Revision #{selectedRevision.revision} vs Current Draft
                    </h3>
                    <span className={styles.inspectorSubtitle}>
                      {formatRevisionDate(selectedRevision.createdAt)} · by {selectedRevision.createdBy}
                    </span>
                  </div>

                  <div className={styles.inspectorControls}>
                    <button
                      className={styles.toggleButton}
                      onClick={() => setViewMode((m) => (m === 'diff' ? 'raw' : 'diff'))}
                      type="button"
                    >
                      {viewMode === 'diff' ? 'Show Raw Snapshot' : 'Show Formatted Diff'}
                    </button>

                    {!isCurrent ? (
                      <button
                        className={styles.restoreButton}
                        disabled={!canRestore || restoring}
                        onClick={() => void handleRestore()}
                        type="button"
                      >
                        <RotateCcw size={14} />
                        <span>{restoring ? 'Restoring…' : `Restore Rev #${selectedRevision.revision}`}</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className={styles.inspectorBody}>
                  {error ? (
                    <p className={styles.emptyState} role="alert">
                      {error}
                    </p>
                  ) : null}

                  {viewMode === 'raw' ? (
                    <pre className={styles.rawCode}>
                      {JSON.stringify(selectedRevision.snapshot, null, 2)}
                    </pre>
                  ) : (
                    <div className={styles.diffTable}>
                      {diffs.map((diff) => (
                        <div
                          className={`${styles.diffRow} ${diff.changed ? styles.diffRowChanged : ''}`}
                          key={diff.key}
                        >
                          <div className={styles.diffFieldHeader}>
                            <span className={styles.fieldName}>{diff.label}</span>
                            {diff.changed ? (
                              <span className={styles.changedTag}>Modified</span>
                            ) : null}
                          </div>

                          {diff.changed ? (
                            <div className={styles.diffValues}>
                              <div className={styles.diffValueBox}>
                                <span className={styles.diffValueLabel}>
                                  In Rev #{selectedRevision.revision}:
                                </span>
                                <div className={styles.oldValue}>
                                  {formatValue(diff.oldValue)}
                                </div>
                              </div>
                              <div className={styles.diffValueBox}>
                                <span className={styles.diffValueLabel}>
                                  In Current Draft:
                                </span>
                                <div className={styles.newValue}>
                                  {formatValue(diff.newValue)}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className={styles.unchangedValue}>
                              {formatValue(diff.newValue)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : loadError ? (
              <div className={styles.emptyState} role="alert">
                <p>{loadError}</p>
                <button
                  className={styles.toggleButton}
                  onClick={() => setRetryCount((c) => c + 1)}
                  type="button"
                >
                  Retry
                </button>
              </div>
            ) : loading ? null : (
              <p className={styles.emptyState}>
                No revision history recorded for this object yet.
              </p>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
