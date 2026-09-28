import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import Moon from 'lucide-react/dist/esm/icons/moon';
import Search from 'lucide-react/dist/esm/icons/search';
import Settings from 'lucide-react/dist/esm/icons/settings';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { getVisibleCampaignCatalog } from '@/demo/campaign-catalog';
import { useCampaignContext } from '@/features/campaigns/CampaignContext';
import { CampaignSwitcher } from '@/features/campaigns/CampaignSwitcher';

import styles from './StudioTopBar.module.css';

interface StudioTopBarProps {
  contextLabel?: string;
  onSearch?: () => void;
  onSettings?: () => void;
  onTheme?: () => void;
  onRestoreNavigation?: () => void;
}

export function StudioTopBar({
  contextLabel,
  onSearch,
  onSettings,
  onTheme,
  onRestoreNavigation,
}: StudioTopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeCampaign, isDemoCampaign } = useCampaignContext();
  const activeExample = getVisibleCampaignCatalog().find((entry) =>
    location.pathname.startsWith(`/demo/${entry.slug}/`),
  );
  const overviewPath = isDemoCampaign
    ? activeExample
      ? `/demo/${activeExample.slug}/overview`
      : '/campaigns'
    : activeCampaign
      ? `/campaigns/${encodeURIComponent(activeCampaign.id)}/overview`
      : '/campaigns';
  const resolvedContextLabel =
    contextLabel ??
    (isDemoCampaign ? activeExample?.campaign.name : activeCampaign?.name);

  function restoreCampaignRail() {
    onRestoreNavigation?.();
    navigate(overviewPath);
  }

  return (
    <header className={styles.topBar}>
      <div className={styles.brandGroup}>
        <Link
          aria-label="Campaign Studio overview"
          className={styles.brand}
          onClick={onRestoreNavigation}
          to={overviewPath}
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

      <div className={styles.mobileSwitcher}>
        <CampaignSwitcher compact />
      </div>

      <div className={styles.actions}>
        {resolvedContextLabel && (
          <span className={styles.context}>{resolvedContextLabel}</span>
        )}
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
