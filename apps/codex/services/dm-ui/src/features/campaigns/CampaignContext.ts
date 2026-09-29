import { createContext, useContext } from 'react';

import type {
  CampaignSummary,
  CreateCampaignInput,
} from '@/services/campaign-api';

export type CampaignLoadState =
  'loading' | 'ready' | 'authentication-required' | 'error';

export interface CampaignContextValue {
  activeCampaign?: CampaignSummary;
  activeCampaignId?: string;
  campaigns: CampaignSummary[];
  createCampaign: (input: CreateCampaignInput) => Promise<CampaignSummary>;
  error?: string;
  isDemoCampaign: boolean;
  lastValidCampaignId?: string;
  reload: () => Promise<void>;
  rememberCampaign: (campaignId: string) => void;
  state: CampaignLoadState;
}

export const CampaignContext = createContext<CampaignContextValue | null>(null);

export function useCampaignContext(): CampaignContextValue {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error('useCampaignContext must be used inside CampaignProvider.');
  }
  return context;
}
