import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCampaignContext } from './CampaignContext';
import styles from './CreateCampaignDialog.module.css';

interface CreateCampaignDialogProps {
  onClose: () => void;
  open: boolean;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

export function CreateCampaignDialog({
  onClose,
  open,
  returnFocusRef,
}: CreateCampaignDialogProps) {
  const { createCampaign } = useCampaignContext();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `create-campaign-title-${useId().replace(/:/g, '')}`;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function closeDialog() {
    if (pending) return;
    setName('');
    setDescription('');
    setError(undefined);
    onClose();
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter a campaign name.');
      return;
    }

    setPending(true);
    setError(undefined);
    try {
      const campaign = await createCampaign({
        description,
        name: trimmedName,
      });
      onClose();
      navigate(`/campaigns/${encodeURIComponent(campaign.id)}/overview`);
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : 'The campaign could not be created.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      aria-labelledby={titleId}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onClose={() => {
        if (open) closeDialog();
      }}
      ref={dialogRef}
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.heading}>
          <h2 id={titleId}>Create campaign</h2>
          <p>Start with a blank, private campaign in Nexus VTT.</p>
        </div>

        <label className={styles.field}>
          <span>Campaign name</span>
          <input
            autoFocus
            disabled={pending}
            maxLength={255}
            name="campaignName"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </label>

        <label className={styles.field}>
          <span>
            Description <small>Optional</small>
          </span>
          <textarea
            disabled={pending}
            name="campaignDescription"
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            value={description}
          />
        </label>

        <div aria-live="polite" className={styles.message} role="status">
          {error}
        </div>

        <div className={styles.actions}>
          <button disabled={pending} onClick={closeDialog} type="button">
            Cancel
          </button>
          <button className={styles.primary} disabled={pending} type="submit">
            {pending ? 'Creating…' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
