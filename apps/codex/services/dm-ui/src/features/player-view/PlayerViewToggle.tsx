import Eye from 'lucide-react/dist/esm/icons/eye';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';

import { usePlayerView } from './playerViewState';
import styles from './PlayerViewToggle.module.css';

export interface PlayerViewToggleProps {
  className?: string;
  label?: string;
  size?: 'sm' | 'md';
}

/**
 * Button to toggle between DM view and "What players see" preview.
 */
export function PlayerViewToggle({
  className = '',
  label = 'Player view',
}: PlayerViewToggleProps) {
  const { isPlayerView, togglePlayerView } = usePlayerView();

  return (
    <button
      aria-label={
        isPlayerView ? 'Toggle player view off' : 'Preview what players see'
      }
      aria-pressed={isPlayerView}
      className={`${styles.toggle} ${isPlayerView ? styles.active : ''} ${className}`}
      onClick={togglePlayerView}
      title={
        isPlayerView
          ? 'Exit player view preview'
          : 'Preview what players see (masks DM notes and unrevealed elements)'
      }
      type="button"
    >
      <span aria-hidden="true" className={styles.icon}>
        {isPlayerView ? <EyeOff size={14} /> : <Eye size={14} />}
      </span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
