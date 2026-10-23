import Eye from 'lucide-react/dist/esm/icons/eye';

import { usePlayerView } from './PlayerViewContext';
import styles from './PlayerViewBanner.module.css';

export interface PlayerViewBannerProps {
  onExit?: () => void;
  title?: string;
  description?: string;
}

/**
 * Notice banner displayed at the top of detail views when "What players see" preview is active.
 */
export function PlayerViewBanner({
  onExit,
  title = 'Player View Preview',
  description = 'Showing only what has been revealed to players. DM notes, unrevealed secrets, and combat statistics are hidden.',
}: PlayerViewBannerProps) {
  const { setPlayerView } = usePlayerView();

  const handleExit = () => {
    if (onExit) onExit();
    else setPlayerView(false);
  };

  return (
    <div
      aria-label="Player view preview notice"
      className={styles.banner}
      role="region"
    >
      <div className={styles.content}>
        <div aria-hidden="true" className={styles.icon}>
          <Eye size={18} />
        </div>
        <div className={styles.textGroup}>
          <span className={styles.title}>{title}</span>
          <p className={styles.description}>{description}</p>
        </div>
      </div>
      <button
        aria-label="Exit player view preview"
        className={styles.exitButton}
        onClick={handleExit}
        type="button"
      >
        Exit preview
      </button>
    </div>
  );
}
