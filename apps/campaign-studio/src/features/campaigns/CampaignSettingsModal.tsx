import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Settings from 'lucide-react/dist/esm/icons/settings';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import X from 'lucide-react/dist/esm/icons/x';

import {
  CAMPAIGN_MOODS,
  type CampaignMood,
  applyMoodToDocument,
  saveLocalMood,
} from '@/features/moods/moodModel';
import {
  deleteCampaign as deleteCampaignApi,
  updateCampaign as updateCampaignApi,
  type CampaignRole,
} from '@/services/campaign-api';

import { useCampaignContext } from './CampaignContext';
import { CampaignMembersSection } from './CampaignMembersSection';
import styles from './CampaignSettingsModal.module.css';

export interface CampaignSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign?: {
    id: string;
    name: string;
    description?: string | null;
    edition?: string;
    mode?: 'campaign' | 'one-shot';
    mood?: string | null;
    role?: CampaignRole;
  };
  isEditable?: boolean;
}

export function CampaignSettingsModal({
  isOpen,
  onClose,
  campaign: propCampaign,
  isEditable = true,
}: CampaignSettingsModalProps) {
  const { activeCampaign, reload } = useCampaignContext();
  const navigate = useNavigate();

  const campaign = propCampaign ?? activeCampaign;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [edition, setEdition] = useState<'2024' | '2014'>('2024');
  const [mode, setMode] = useState<'campaign' | 'one-shot'>('campaign');
  const [mood, setMood] = useState<CampaignMood>('parchment');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (campaign && isOpen) {
      setName(campaign.name);
      setDescription(campaign.description ?? '');
      setEdition(campaign.edition === '2014' ? '2014' : '2024');
      setMode(campaign.mode === 'one-shot' ? 'one-shot' : 'campaign');
      setMood(
        CAMPAIGN_MOODS.some((m) => m.id === campaign.mood)
          ? (campaign.mood as CampaignMood)
          : 'parchment',
      );
      setConfirmingDelete(false);
      setError(undefined);
    }
  }, [campaign, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !campaign) return null;

  // Co-DMs edit settings and prep; deleting the campaign stays with the owner.
  const isOwner = campaign.role !== 'co-dm';

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaign || !isEditable) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Campaign name is required.');
      return;
    }

    setPending(true);
    setError(undefined);
    try {
      await updateCampaignApi(campaign.id, {
        name: trimmed,
        description: description.trim() || undefined,
        edition,
        mode,
        mood,
      });
      saveLocalMood(mood, campaign.id);
      applyMoodToDocument(mood);
      await reload();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update campaign settings.',
      );
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!campaign || !isEditable || campaign.role === 'co-dm') return;
    setPending(true);
    setError(undefined);
    try {
      await deleteCampaignApi(campaign.id);
      await reload();
      onClose();
      navigate('/campaigns');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to delete campaign.',
      );
      setPending(false);
    }
  }

  return (
    <div
      aria-labelledby="campaign-settings-title"
      aria-modal="true"
      className={styles.backdrop}
      role="dialog"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Settings size={20} aria-hidden="true" />
            <h2 id="campaign-settings-title">Campaign Settings</h2>
          </div>
          <button
            aria-label="Close settings"
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSave}>
          {!isEditable && (
            <div className={styles.readOnlyNotice} role="status">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>
                This example fixture is read-only. Settings cannot be edited or deleted.
              </span>
            </div>
          )}

          <label className={styles.field}>
            <span>Campaign name</span>
            <input
              disabled={pending || !isEditable}
              maxLength={255}
              name="campaignName"
              onChange={(e) => setName(e.target.value)}
              value={name}
            />
          </label>

          <label className={styles.field}>
            <span>
              Description <small>Optional</small>
            </span>
            <textarea
              disabled={pending || !isEditable}
              name="campaignDescription"
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              value={description}
            />
          </label>

          <div
            aria-label="Rules edition"
            className={styles.formatGroup}
            role="radiogroup"
          >
            <span>Rules Edition</span>
            <div className={styles.formatOptions}>
              <button
                aria-checked={edition === '2024'}
                className={`${styles.formatOption} ${edition === '2024' ? styles.formatOptionSelected : ''}`}
                disabled={pending || !isEditable}
                onClick={() => setEdition('2024')}
                role="radio"
                type="button"
              >
                <strong className={styles.formatOptionTitle}>2024 Rules</strong>
                <span className={styles.formatOptionDesc}>
                  Modern 5e SRD revision
                </span>
              </button>
              <button
                aria-checked={edition === '2014'}
                className={`${styles.formatOption} ${edition === '2014' ? styles.formatOptionSelected : ''}`}
                disabled={pending || !isEditable}
                onClick={() => setEdition('2014')}
                role="radio"
                type="button"
              >
                <strong className={styles.formatOptionTitle}>2014 Legacy</strong>
                <span className={styles.formatOptionDesc}>
                  Classic 5e SRD rules
                </span>
              </button>
            </div>
          </div>

          <div
            aria-label="Adventure format"
            className={styles.formatGroup}
            role="radiogroup"
          >
            <span>Format</span>
            <div className={styles.formatOptions}>
              <button
                aria-checked={mode === 'campaign'}
                className={`${styles.formatOption} ${mode === 'campaign' ? styles.formatOptionSelected : ''}`}
                disabled={pending || !isEditable}
                onClick={() => setMode('campaign')}
                role="radio"
                type="button"
              >
                <strong className={styles.formatOptionTitle}>Campaign</strong>
                <span className={styles.formatOptionDesc}>
                  Multi-session continuous story
                </span>
              </button>
              <button
                aria-checked={mode === 'one-shot'}
                className={`${styles.formatOption} ${mode === 'one-shot' ? styles.formatOptionSelected : ''}`}
                disabled={pending || !isEditable}
                onClick={() => setMode('one-shot')}
                role="radio"
                type="button"
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
              disabled={pending || !isEditable}
              name="campaignMood"
              onChange={(e) => setMood(e.target.value as CampaignMood)}
              value={mood}
            >
              {CAMPAIGN_MOODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.tagline}
                </option>
              ))}
            </select>
          </label>

          {isEditable && <CampaignMembersSection campaignId={campaign.id} />}

          {isEditable && isOwner && (
            <div className={styles.dangerSection}>
              <h3 className={styles.dangerHeader}>Danger Zone</h3>
              <p className={styles.dangerText}>
                Deleting this campaign permanently removes all world notes, NPCs, factions,
                and session plans. This action cannot be undone.
              </p>
              {confirmingDelete ? (
                <div className={styles.dangerConfirmBox}>
                  <strong>Are you sure you want to delete &ldquo;{campaign.name}&rdquo;?</strong>
                  <div className={styles.dangerActions}>
                    <button
                      className={`${styles.button} ${styles.dangerButtonSolid}`}
                      disabled={pending}
                      onClick={handleDelete}
                      type="button"
                    >
                      {pending ? 'Deleting…' : 'Yes, Delete Campaign'}
                    </button>
                    <button
                      className={styles.button}
                      disabled={pending}
                      onClick={() => setConfirmingDelete(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <button
                    className={`${styles.button} ${styles.dangerButton}`}
                    disabled={pending}
                    onClick={() => setConfirmingDelete(true)}
                    type="button"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    <span>Delete Campaign</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div aria-live="polite" className={styles.message} role="alert">
              {error}
            </div>
          )}

          <div className={styles.footer}>
            <div className={styles.footerActions}>
              <button
                className={styles.button}
                disabled={pending}
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
              {isEditable && (
                <button
                  className={`${styles.button} ${styles.primaryButton}`}
                  disabled={pending}
                  type="submit"
                >
                  {pending ? 'Saving…' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
