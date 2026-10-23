import React from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import type { RevealedHandout } from '@/stores/handoutFeedStore';
import styles from './HandoutSpotlight.module.css';

export interface HandoutSpotlightProps {
  handout: RevealedHandout;
  onDismiss: () => void;
}

/** Full-screen view of a handout the DM just revealed. */
export const HandoutSpotlight: React.FC<HandoutSpotlightProps> = ({
  handout,
  onDismiss,
}) => (
  <div
    className={styles.spotlight}
    role="dialog"
    aria-modal="true"
    aria-label={handout.title}
  >
    <header className={styles.header}>
      <h2>{handout.title}</h2>
      <button
        type="button"
        className={styles.close}
        aria-label="Close handout"
        onClick={onDismiss}
      >
        <X size={24} aria-hidden="true" />
      </button>
    </header>
    {handout.url && (
      <img className={styles.image} src={handout.url} alt={handout.title} />
    )}
  </div>
);
