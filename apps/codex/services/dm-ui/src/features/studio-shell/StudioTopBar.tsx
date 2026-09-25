import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import Moon from 'lucide-react/dist/esm/icons/moon';
import Search from 'lucide-react/dist/esm/icons/search';
import Settings from 'lucide-react/dist/esm/icons/settings';
import { Link, useNavigate } from 'react-router-dom';

import styles from './StudioTopBar.module.css';

interface StudioTopBarProps {
  contextLabel?: string;
  onSearch?: () => void;
  onSettings?: () => void;
  onTheme?: () => void;
  onRestoreNavigation?: () => void;
}

export function StudioTopBar({
  contextLabel = 'Ashes of Veyra',
  onSearch,
  onSettings,
  onTheme,
  onRestoreNavigation,
}: StudioTopBarProps) {
  const navigate = useNavigate();

  function restoreCampaignRail() {
    onRestoreNavigation?.();
    navigate('/campaigns/ashes-of-veyra/overview');
  }

  return (
    <header className={styles.topBar}>
      <div className={styles.brandGroup}>
        <Link
          aria-label="Campaign Studio overview"
          className={styles.brand}
          onClick={onRestoreNavigation}
          to="/campaigns/ashes-of-veyra/overview"
        >
          <span className={styles.brandMark} aria-hidden="true">
            <BookOpen size={17} strokeWidth={1.8} />
          </span>
          <span className={styles.product}>Nexus VTT</span>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.studio}>Campaign Studio</span>
        </Link>
        <button
          aria-label="Return to overview and expand campaign sidebar"
          className={styles.restoreButton}
          onClick={restoreCampaignRail}
          title="Return to overview and expand campaign sidebar"
          type="button"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      <div className={styles.actions}>
        <span className={styles.context}>{contextLabel}</span>
        <button
          aria-label="Search campaign"
          className={styles.iconButton}
          onClick={onSearch}
          title="Search campaign"
          type="button"
        >
          <Search size={16} />
        </button>
        <button
          aria-label="Change theme"
          className={styles.iconButton}
          onClick={onTheme}
          title="Change theme"
          type="button"
        >
          <Moon size={16} />
        </button>
        <button
          aria-label="Campaign settings"
          className={styles.iconButton}
          onClick={onSettings}
          title="Campaign settings"
          type="button"
        >
          <Settings size={16} />
        </button>
        <button
          aria-label="Open profile"
          className={styles.avatar}
          title="Open profile"
          type="button"
        >
          NV
        </button>
      </div>
    </header>
  );
}
