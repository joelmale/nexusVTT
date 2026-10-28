import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days';
import CheckSquare from 'lucide-react/dist/esm/icons/check-square';
import Compass from 'lucide-react/dist/esm/icons/compass';
import Gem from 'lucide-react/dist/esm/icons/gem';
import Images from 'lucide-react/dist/esm/icons/images';
import Inbox from 'lucide-react/dist/esm/icons/inbox';
import MapIcon from 'lucide-react/dist/esm/icons/map';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Moon from 'lucide-react/dist/esm/icons/moon';
import Network from 'lucide-react/dist/esm/icons/network';
import PanelLeftClose from 'lucide-react/dist/esm/icons/panel-left-close';
import Search from 'lucide-react/dist/esm/icons/search';
import Settings from 'lucide-react/dist/esm/icons/settings';
import Shield from 'lucide-react/dist/esm/icons/shield';
import Swords from 'lucide-react/dist/esm/icons/swords';
import UserRound from 'lucide-react/dist/esm/icons/user-round';
import { useLocation, useNavigate } from 'react-router-dom';

import { getVisibleCampaignCatalog } from '@/demo/campaign-catalog';
import { useCampaignContext } from '@/features/campaigns/CampaignContext';
import { CampaignSwitcher } from '@/features/campaigns/CampaignSwitcher';
import type { CapabilityId } from '@/features/capability-notice';

import { useStudioNavigation } from './StudioNavigationContext';
import styles from './StudioCampaignRail.module.css';

interface StudioCampaignRailProps {
  onCapability: (capabilityId: CapabilityId) => void;
  /** Opens campaign search. Shown on touch devices, which have no Ctrl+K. */
  onSearch?: () => void;
  onQuickCapture?: () => void;
  onRelationshipWeb?: () => void;
  onTheme?: () => void;
  onSettings?: () => void;
}

const NAVIGATION_ITEMS = [
  { icon: Compass, label: 'Overview', route: 'overview' },
  { icon: CalendarDays, label: 'Sessions', route: 'sessions' },
  { icon: MapIcon, label: 'World & Locations', route: 'world' },
  { icon: UserRound, label: 'NPCs', route: 'npcs' },
  { icon: Shield, label: 'Factions', route: 'factions' },
  { icon: CheckSquare, label: 'Quests', route: 'quests' },
  { icon: Swords, label: 'Encounters', route: 'encounters' },
  { icon: Gem, label: 'Items', route: 'items' },
  { icon: MapPin, label: 'Maps', route: 'maps' },
  { icon: Images, label: 'Assets', route: 'assets' },
  { icon: BookOpen, label: 'Notes', route: 'notes' },
] as const;

export function StudioCampaignRail({
  onCapability,
  onSearch,
  onQuickCapture,
  onRelationshipWeb,
  onTheme,
  onSettings,
}: StudioCampaignRailProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeCampaign, isDemoCampaign } = useCampaignContext();
  const { collapseCampaignRail } = useStudioNavigation();
  const activeExample = getVisibleCampaignCatalog().find((entry) =>
    location.pathname.startsWith(`/demo/${entry.slug}/`),
  );
  const campaignBase = isDemoCampaign
    ? activeExample
      ? `/demo/${activeExample.slug}`
      : undefined
    : activeCampaign
      ? `/campaigns/${encodeURIComponent(activeCampaign.id)}`
      : undefined;

  const activeRoute = campaignBase
    ? (location.pathname.slice(campaignBase.length).split('/')[1] ?? 'overview')
    : 'overview';

  function selectRoute(route: (typeof NAVIGATION_ITEMS)[number]['route']) {
    if (!campaignBase) return;
    navigate(`${campaignBase}/${route}`);
  }

  function handleBrandClick() {
    if (campaignBase) {
      navigate(`${campaignBase}/overview`);
    } else {
      navigate('/campaigns');
    }
  }

  return (
    <aside className={styles.rail} aria-label="Campaign navigation">
      <div className={styles.brandRow}>
        <button
          aria-label={campaignBase ? 'Return to campaign overview' : 'Return to campaigns'}
          className={styles.brand}
          onClick={handleBrandClick}
          type="button"
        >
          <span className={styles.brandMark} aria-hidden="true">
            <Compass size={19} />
          </span>
          <span>
            <strong>Nexus VTT</strong>
            <small>Campaign Studio</small>
          </span>
        </button>
        <button
          aria-label="Collapse campaign sidebar"
          className={styles.collapseButton}
          onClick={collapseCampaignRail}
          title="Collapse campaign sidebar"
          type="button"
        >
          <PanelLeftClose size={17} />
        </button>
      </div>

      <span className={styles.campaignLabel}>Campaigns</span>
      <CampaignSwitcher />

      {onSearch ? (
        <button
          className={styles.searchButton}
          onClick={onSearch}
          type="button"
        >
          <Search size={18} />
          <span>Search</span>
        </button>
      ) : null}

      <nav className={styles.navigation}>
        {NAVIGATION_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.route === activeRoute;
          return (
            <button
              aria-current={active ? 'page' : undefined}
              className={`${styles.navItem} ${active ? styles.navActive : ''}`}
              disabled={!campaignBase}
              key={item.route}
              onClick={() => selectRoute(item.route)}
              type="button"
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className={styles.railFooter}>
        {onQuickCapture ? (
          <button
            aria-label="Quick capture (Ctrl+Shift+N)"
            className={styles.utilityItem}
            onClick={onQuickCapture}
            title="Quick capture (Ctrl+Shift+N)"
            type="button"
          >
            <Inbox size={18} />
            <span>Quick capture</span>
          </button>
        ) : null}
        {onRelationshipWeb ? (
          <button
            aria-label="Relationship web"
            className={styles.utilityItem}
            onClick={onRelationshipWeb}
            title="Relationship web"
            type="button"
          >
            <Network size={18} />
            <span>Relationship web</span>
          </button>
        ) : null}
        {onTheme ? (
          <button
            aria-label="Change theme"
            className={styles.utilityItem}
            onClick={onTheme}
            title="Change theme"
            type="button"
          >
            <Moon size={18} />
            <span>Change theme</span>
          </button>
        ) : null}
        <button
          aria-label="Campaign settings"
          className={styles.settings}
          onClick={() => {
            if (onSettings) onSettings();
            else onCapability('campaign.settings.open');
          }}
          type="button"
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
