import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { StudioNavigationContext } from './StudioNavigationContext';

interface StudioNavigationProviderProps {
  children: ReactNode;
}

export function StudioNavigationProvider({
  children,
}: StudioNavigationProviderProps) {
  const [isCampaignRailExpanded, setCampaignRailExpanded] = useState(true);
  const collapseCampaignRail = useCallback(
    () => setCampaignRailExpanded(false),
    [],
  );
  const expandCampaignRail = useCallback(
    () => setCampaignRailExpanded(true),
    [],
  );
  const value = useMemo(
    () => ({
      collapseCampaignRail,
      expandCampaignRail,
      isCampaignRailExpanded,
    }),
    [collapseCampaignRail, expandCampaignRail, isCampaignRailExpanded],
  );

  return (
    <StudioNavigationContext.Provider value={value}>
      {children}
    </StudioNavigationContext.Provider>
  );
}
