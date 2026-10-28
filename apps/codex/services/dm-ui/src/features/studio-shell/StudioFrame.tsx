import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import type { CapabilityId } from '@/features/capability-notice';

import { StudioCampaignRail } from './StudioCampaignRail';
import { useStudioNavigation } from './StudioNavigationContext';
import { StudioTopBar } from './StudioTopBar';
import styles from './StudioFrame.module.css';

interface StudioFrameProps {
  children: ReactNode;
  contextLabel?: string;
  onSearch?: () => void;
  onQuickCapture?: () => void;
  onSettings?: () => void;
  onTheme?: () => void;
  onRelationshipWeb?: () => void;
  onProfile?: () => void;
  onCapability: (capabilityId: CapabilityId) => void;
}

export function StudioFrame({
  children,
  contextLabel,
  onSearch,
  onQuickCapture,
  onSettings,
  onTheme,
  onRelationshipWeb,
  onProfile,
  onCapability,
}: StudioFrameProps) {
  const { expandCampaignRail, isCampaignRailExpanded } = useStudioNavigation();
  const { pathname } = useLocation();
  // Below 820px the rail is hidden; this opens it as a drawer instead.
  const [isNavDrawerOpen, setNavDrawerOpen] = useState(false);

  useEffect(() => {
    setNavDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isNavDrawerOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isNavDrawerOpen]);

  const compactTopBar = (
    <StudioTopBar
      contextLabel={contextLabel}
      onOpenNavigation={() => setNavDrawerOpen(true)}
      onProfile={onProfile}
      onQuickCapture={onQuickCapture}
      onRelationshipWeb={onRelationshipWeb}
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
          <StudioCampaignRail
            onCapability={onCapability}
            onQuickCapture={onQuickCapture}
            onRelationshipWeb={onRelationshipWeb}
            onSearch={onSearch}
            onSettings={onSettings}
            onTheme={onTheme}
          />
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
      {isNavDrawerOpen ? (
        <div className={styles.navDrawerLayer}>
          <button
            aria-label="Close campaign navigation"
            className={styles.navDrawerBackdrop}
            onClick={() => setNavDrawerOpen(false)}
            type="button"
          />
          <div
            className={styles.navDrawer}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('nav button')) {
                setNavDrawerOpen(false);
              }
            }}
          >
            <StudioCampaignRail
              onCapability={onCapability}
              onQuickCapture={onQuickCapture}
              onRelationshipWeb={onRelationshipWeb}
              onSearch={onSearch}
              onSettings={onSettings}
              onTheme={onTheme}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
