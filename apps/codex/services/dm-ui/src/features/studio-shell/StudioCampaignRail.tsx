import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days';
import CheckSquare from 'lucide-react/dist/esm/icons/check-square';
import Compass from 'lucide-react/dist/esm/icons/compass';
import MapIcon from 'lucide-react/dist/esm/icons/map';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import PanelLeftClose from 'lucide-react/dist/esm/icons/panel-left-close';
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
}

const NAVIGATION_ITEMS = [
  { icon: Compass, label: 'Overview', route: 'overview' },
  { icon: CalendarDays, label: 'Sessions', route: 'sessions' },
  { icon: MapIcon, label: 'World', route: 'world' },
  { icon: UserRound, label: 'NPCs', route: 'npcs' },
  { icon: Shield, label: 'Factions', route: 'factions' },
  { icon: CheckSquare, label: 'Quests', route: 'quests' },
  { icon: Swords, label: 'Encounters', route: 'encounters' },
  { icon: MapPin, label: 'Maps', route: 'maps' },
  { icon: BookOpen, label: 'Notes', route: 'notes' },
] as const;

export function StudioCampaignRail({ onCapability }: StudioCampaignRailProps) {
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

  return (
    <aside className={styles.rail} aria-label="Campaign navigation">
      <div className={styles.brandRow}>
        <button
          aria-label="Return to campaign overview"
          className={styles.brand}
          onClick={() => selectRoute('overview')}
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

      <button
        className={styles.settings}
        onClick={() => onCapability('campaign.settings.open')}
        type="button"
      >
        <Settings size={18} />
        <span>Settings</span>
      </button>
    </aside>
  );
}
