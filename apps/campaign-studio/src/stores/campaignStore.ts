import { create } from 'zustand';
import { Campaign } from '@/db/schema';

interface CampaignStore {
  activeCampaign: Campaign | null;
  setActiveCampaign: (campaign: Campaign | null) => void;
  clearActiveCampaign: () => void;
}

export const useCampaignStore = create<CampaignStore>((set) => ({
  activeCampaign: null,
  setActiveCampaign: (campaign) => {
    set({ activeCampaign: campaign });
    // Persist to localStorage
    if (campaign) {
      localStorage.setItem('activeCampaignId', campaign.id);
    } else {
      localStorage.removeItem('activeCampaignId');
    }
  },
  clearActiveCampaign: () => {
    set({ activeCampaign: null });
    localStorage.removeItem('activeCampaignId');
  }
}));
