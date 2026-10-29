import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import {
  CampaignApiError,
  createCampaign as createCampaignRequest,
  listCampaigns,
  type CampaignSummary,
  type CreateCampaignInput,
} from '@/services/campaign-api';

import { CampaignContext, type CampaignLoadState } from './CampaignContext';

const LAST_CAMPAIGN_KEY = 'nexus.campaign-studio.last-campaign-id';

function campaignIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/campaigns\/([^/]+)(?:\/|$)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function getRememberedCampaignId(): string | undefined {
  try {
    return localStorage.getItem(LAST_CAMPAIGN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function CampaignProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [state, setState] = useState<CampaignLoadState>('loading');
  const [error, setError] = useState<string>();
  const [lastValidCampaignId, setLastValidCampaignId] = useState<
    string | undefined
  >(getRememberedCampaignId);
  const activeCampaignId = campaignIdFromPath(location.pathname);
  const isDemoCampaign = location.pathname.startsWith('/demo/');
  const activeCampaign = campaigns.find(
    (campaign) => campaign.id === activeCampaignId,
  );

  const rememberCampaign = useCallback((campaignId: string) => {
    setLastValidCampaignId(campaignId);
    try {
      localStorage.setItem(LAST_CAMPAIGN_KEY, campaignId);
    } catch {
      // Navigation remains route-driven when storage is unavailable.
    }
  }, []);

  const reload = useCallback(async () => {
    setState('loading');
    setError(undefined);
    try {
      const loadedCampaigns = await listCampaigns();
      setCampaigns(loadedCampaigns);
      setLastValidCampaignId((rememberedId) => {
        if (
          rememberedId &&
          loadedCampaigns.some((campaign) => campaign.id === rememberedId)
        ) {
          return rememberedId;
        }
        const fallbackId = loadedCampaigns[0]?.id;
        try {
          if (fallbackId) localStorage.setItem(LAST_CAMPAIGN_KEY, fallbackId);
          else localStorage.removeItem(LAST_CAMPAIGN_KEY);
        } catch {
          // The in-memory fallback still works.
        }
        return fallbackId;
      });
      setState('ready');
    } catch (loadError) {
      setCampaigns([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Campaigns could not be loaded.',
      );
      setState(
        loadError instanceof CampaignApiError &&
          (loadError.status === 401 || loadError.status === 403)
          ? 'authentication-required'
          : 'error',
      );
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (activeCampaign) rememberCampaign(activeCampaign.id);
  }, [activeCampaign, rememberCampaign]);

  const createCampaign = useCallback(
    async (input: CreateCampaignInput) => {
      const created = await createCampaignRequest(input);
      setCampaigns((current) => [
        created,
        ...current.filter((campaign) => campaign.id !== created.id),
      ]);
      setState('ready');
      rememberCampaign(created.id);
      return created;
    },
    [rememberCampaign],
  );

  const value = useMemo(
    () => ({
      activeCampaign,
      activeCampaignId,
      campaigns,
      createCampaign,
      error,
      isDemoCampaign,
      lastValidCampaignId,
      reload,
      rememberCampaign,
      state,
    }),
    [
      activeCampaign,
      activeCampaignId,
      campaigns,
      createCampaign,
      error,
      isDemoCampaign,
      lastValidCampaignId,
      reload,
      rememberCampaign,
      state,
    ],
  );

  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  );
}
