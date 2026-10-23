import { useEffect, useRef, useState } from 'react';
import Check from 'lucide-react/dist/esm/icons/check';
import X from 'lucide-react/dist/esm/icons/x';

import { useCampaignContext } from '@/features/campaigns/CampaignContext';
import { useCampaignMood } from './MoodContext';
import { CAMPAIGN_MOODS, type CampaignMood } from './moodModel';
import styles from './MoodPickerModal.module.css';

export interface MoodPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MoodPickerModal({ isOpen, onClose }: MoodPickerModalProps) {
  const { currentMood, setMood } = useCampaignMood();
  const { activeCampaign, isDemoCampaign } = useCampaignContext();
  const [selectedMood, setSelectedMood] = useState<CampaignMood>(currentMood);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Sync selectedMood when modal opens or currentMood changes
  useEffect(() => {
    if (isOpen) {
      setSelectedMood(currentMood);
    }
  }, [isOpen, currentMood]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (mood: CampaignMood) => {
    setSelectedMood(mood);
    void setMood(mood, saveAsDefault);
  };

  const handlePersistChange = (checked: boolean) => {
    setSaveAsDefault(checked);
    if (checked) {
      void setMood(selectedMood, true);
    }
  };

  const isEditable = !isDemoCampaign && Boolean(activeCampaign);

  return (
    <div
      aria-label="Campaign Mood Picker backdrop"
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        aria-describedby="mood-modal-desc"
        aria-labelledby="mood-modal-title"
        aria-modal="true"
        className={styles.modal}
        ref={dialogRef}
        role="dialog"
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="mood-modal-title">Campaign Atmosphere & Mood</h2>
            <p className={styles.subtitle} id="mood-modal-desc">
              Choose a visual palette that reflects your campaign’s tone and aesthetic.
            </p>
          </div>
          <button
            aria-label="Close mood picker"
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.body}>
          <ul aria-label="Available moods" className={styles.moodList}>
            {CAMPAIGN_MOODS.map((mood) => {
              const isActive = selectedMood === mood.id;
              return (
                <li key={mood.id}>
                  <button
                    aria-pressed={isActive}
                    className={`${styles.moodCard} ${isActive ? styles.moodCardActive : ''}`}
                    onClick={() => handleSelect(mood.id)}
                    type="button"
                  >
                    <div
                      aria-hidden="true"
                      className={styles.swatchPreview}
                      style={{
                        backgroundColor: mood.canvasColor,
                        borderColor: mood.accentColor,
                      }}
                    >
                      <div
                        className={styles.swatchAccentDot}
                        style={{ backgroundColor: mood.accentColor }}
                      />
                    </div>

                    <div className={styles.moodInfo}>
                      <div className={styles.moodTitleRow}>
                        <span className={styles.moodLabel}>{mood.label}</span>
                        <span className={styles.tagline}>— {mood.tagline}</span>
                        <span className={styles.modeBadge}>
                          {mood.isDark ? 'Dark' : 'Light'}
                        </span>
                      </div>
                      <p className={styles.moodDescription}>{mood.description}</p>
                    </div>

                    {isActive ? (
                      <span aria-hidden="true" className={styles.activeIndicator}>
                        <Check size={14} strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <footer className={styles.footer}>
          {isEditable ? (
            <label className={styles.persistOption}>
              <input
                checked={saveAsDefault}
                className={styles.persistCheckbox}
                onChange={(e) => handlePersistChange(e.target.checked)}
                type="checkbox"
              />
              <span>Save as campaign default for all players</span>
            </label>
          ) : (
            <div />
          )}

          <div className={styles.actions}>
            <button className={styles.doneButton} onClick={onClose} type="button">
              Done
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
