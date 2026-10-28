import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { useNavigate } from 'react-router-dom';

import { CAMPAIGN_MOODS, type CampaignMood } from '@/features/moods/moodModel';
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
  const [mode, setMode] = useState<'campaign' | 'one-shot'>('campaign');
  const [edition, setEdition] = useState<'2024' | '2014'>('2024');
  const [mood, setMood] = useState<CampaignMood>('parchment');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function resetForm() {
    setName('');
    setDescription('');
    setMode('campaign');
    setEdition('2024');
    setMood('parchment');
    setError(undefined);
  }

  function closeDialog() {
    if (pending) return;
    resetForm();
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
        edition,
        mode,
        mood,
        name: trimmedName,
      });
      resetForm();
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

        <div
          className={styles.formatGroup}
          role="radiogroup"
          aria-label="Rules edition"
        >
          <span>Rules Edition</span>
          <div className={styles.formatOptions}>
            <button
              type="button"
              role="radio"
              aria-checked={edition === '2024'}
              className={`${styles.formatOption} ${edition === '2024' ? styles.formatOptionSelected : ''}`}
              onClick={() => setEdition('2024')}
              disabled={pending}
            >
              <strong className={styles.formatOptionTitle}>2024 Rules</strong>
              <span className={styles.formatOptionDesc}>
                Modern 5e SRD revision
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={edition === '2014'}
              className={`${styles.formatOption} ${edition === '2014' ? styles.formatOptionSelected : ''}`}
              onClick={() => setEdition('2014')}
              disabled={pending}
            >
              <strong className={styles.formatOptionTitle}>2014 Legacy</strong>
              <span className={styles.formatOptionDesc}>
                Classic 5e SRD rules
              </span>
            </button>
          </div>
        </div>

        <div
          className={styles.formatGroup}
          role="radiogroup"
          aria-label="Adventure format"
        >
          <span>Format</span>
          <div className={styles.formatOptions}>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'campaign'}
              className={`${styles.formatOption} ${mode === 'campaign' ? styles.formatOptionSelected : ''}`}
              onClick={() => setMode('campaign')}
              disabled={pending}
            >
              <strong className={styles.formatOptionTitle}>Campaign</strong>
              <span className={styles.formatOptionDesc}>
                Multi-session continuous story
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'one-shot'}
              className={`${styles.formatOption} ${mode === 'one-shot' ? styles.formatOptionSelected : ''}`}
              onClick={() => setMode('one-shot')}
              disabled={pending}
            >
              <strong className={styles.formatOptionTitle}>One-Shot</strong>
              <span className={styles.formatOptionDesc}>
                Single-session self-contained adventure
              </span>
            </button>
          </div>
        </div>

        <label className={styles.field}>
          <span>Visual Theme & Mood</span>
          <select
            className={styles.select}
            disabled={pending}
            name="campaignMood"
            onChange={(event) => setMood(event.target.value as CampaignMood)}
            value={mood}
          >
            {CAMPAIGN_MOODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.tagline}
              </option>
            ))}
          </select>
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
