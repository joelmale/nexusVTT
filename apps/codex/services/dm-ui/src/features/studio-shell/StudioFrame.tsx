import type { ReactNode } from 'react';

import type { CapabilityId } from '@/features/capability-notice';

import { StudioCampaignRail } from './StudioCampaignRail';
import { useStudioNavigation } from './StudioNavigationContext';
import { StudioTopBar } from './StudioTopBar';
import styles from './StudioFrame.module.css';

interface StudioFrameProps {
  children: ReactNode;
  contextLabel?: string;
  onSearch?: () => void;
  onSettings?: () => void;
  onTheme?: () => void;
  onCapability: (capabilityId: CapabilityId) => void;
}

export function StudioFrame({
  children,
  contextLabel,
  onSearch,
  onSettings,
  onTheme,
  onCapability,
}: StudioFrameProps) {
  const { expandCampaignRail, isCampaignRailExpanded } = useStudioNavigation();

  const compactTopBar = (
    <StudioTopBar
      contextLabel={contextLabel}
      onRestoreNavigation={expandCampaignRail}
      onSearch={onSearch}
      onSettings={onSettings}
      onTheme={onTheme}
    />
  );

  return (
    <div className={styles.frame}>
      {isCampaignRailExpanded ? (
        <div className={styles.expandedFrame}>
          <StudioCampaignRail onCapability={onCapability} />
          <div className={styles.expandedMain}>
            <div className={styles.mobileTopBar}>{compactTopBar}</div>
            <div className={styles.content}>{children}</div>
          </div>
        </div>
      ) : (
        <>
          {compactTopBar}
          <div className={styles.content}>{children}</div>
        </>
      )}
    </div>
  );
}
