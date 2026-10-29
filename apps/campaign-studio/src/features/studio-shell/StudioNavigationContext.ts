import { createContext, useContext } from 'react';

export interface StudioNavigationContextValue {
  collapseCampaignRail: () => void;
  expandCampaignRail: () => void;
  isCampaignRailExpanded: boolean;
}

export const StudioNavigationContext =
  createContext<StudioNavigationContextValue | null>(null);

export function useStudioNavigation(): StudioNavigationContextValue {
  const context = useContext(StudioNavigationContext);
  if (!context) {
    throw new Error(
      'useStudioNavigation must be used within StudioNavigationProvider',
    );
  }
  return context;
}
