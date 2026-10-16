import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

import type { BacklinkRef, EditableKind } from './bundleStore';
import styles from './RemoveItemButton.module.css';
import { SectionContext } from './SectionContext';
import { showUndoToast } from './undoToast';

export interface RemoveItemButtonProps {
  kind: EditableKind;
  id: string;
  /** Human name of the item, used in the dialog and the undo notice. */
  label: string;
  /** Called after the server accepted the removal. */
  onRemoved?: () => void;
  /**
   * Section path under the campaign base (e.g. `npcs`). After removal the
   * view navigates to the section list, and Undo navigates back to
   * `<listPath>/<id>`. Omit when the button sits on the list itself.
   */
  listPath?: string;
}

function describeFailure(error: string | undefined): string {
  if (error === 'not-found') return 'This item cannot be removed here.';
  return error ?? 'The item could not be removed.';
}

/**
 * Trash button + confirmation for archiving a campaign item (soft delete).
 * Renders nothing unless the current store is editable.
 */
export function RemoveItemButton({
  kind,
  id,
  label,
  onRemoved,
  listPath,
}: RemoveItemButtonProps) {
  const section = useContext(SectionContext);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [backlinks, setBacklinks] = useState<BacklinkRef[] | 'loading'>(
    'loading',
  );
  const [backlinksFailed, setBacklinksFailed] = useState(false);

  const store = section?.store;
  const basePath = section?.basePath ?? '';
  const bundle = section?.bundle;

  const childHandouts =
    kind === 'handout-folder' && bundle
      ? bundle.handouts.filter((handout) => handout.folderId === id).length
      : 0;
  const blocked = childHandouts > 0;

  useEffect(() => {
    if (!open || !store || blocked) return;
    let cancelled = false;
    setBacklinks('loading');
    setBacklinksFailed(false);
    store
      .getBacklinks(id)
      .then((refs) => {
        if (!cancelled) setBacklinks(refs);
      })
      .catch(() => {
        if (!cancelled) {
          setBacklinks([]);
          setBacklinksFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, store, id, blocked]);

  if (!store?.editable) return null;

  const close = () => {
    setOpen(false);
    setFailure(undefined);
  };

  const confirm = async () => {
    setBusy(true);
    setFailure(undefined);
    const result = await store.removeItem(kind, id);
    setBusy(false);
    if (!result.ok) {
      setFailure(
        result.conflict
          ? 'This item changed elsewhere. Reload and try again.'
          : describeFailure(result.error),
      );
      return;
    }
    setOpen(false);
    onRemoved?.();
    const detailPath = listPath ? `${basePath}/${listPath}/${id}` : undefined;
    if (listPath) navigate(`${basePath}/${listPath}`);
    showUndoToast({
      message: `Removed "${label}".`,
      onUndo: async () => {
        const restored = await store.restoreItem(kind, id);
        if (!restored.ok) return describeFailure(restored.error);
        if (detailPath) navigate(detailPath);
        return undefined;
      },
    });
  };

  return (
    <>
      <button
        aria-label={`Remove ${label}`}
        className={styles.trigger}
        onClick={() => setOpen(true)}
        title="Remove"
        type="button"
      >
        <Trash2 aria-hidden="true" size={16} />
      </button>
      <ConfirmDialog
        busy={busy}
        confirmLabel="Remove"
        description={
          blocked
            ? undefined
            : 'It is hidden from the campaign right away, and you can undo this afterwards.'
        }
        hideConfirm={blocked}
        onCancel={close}
        onConfirm={() => void confirm()}
        open={open}
        title={`Remove "${label}"?`}
      >
        {blocked ? (
          <p className={styles.blocked}>
            This folder still holds {childHandouts}{' '}
            {childHandouts === 1 ? 'handout' : 'handouts'}. Move or remove them
            first.
          </p>
        ) : backlinks === 'loading' ? (
          <p className={styles.refs}>Checking references…</p>
        ) : backlinks.length > 0 ? (
          <div className={styles.refs}>
            <p>Referenced by:</p>
            <ul>
              {backlinks.map((ref) => (
                <li key={ref.id}>{ref.title}</li>
              ))}
            </ul>
          </div>
        ) : backlinksFailed ? (
          <p className={styles.refs}>Could not check what references this.</p>
        ) : null}
        {failure ? (
          <p className={styles.error} role="alert">
            {failure}
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
