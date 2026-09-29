import { Navigate } from 'react-router-dom';

import { useCampaignContext } from '@/features/campaigns/CampaignContext';

export function CampaignRootRoute() {
  const { campaigns, lastValidCampaignId, state } = useCampaignContext();

  if (state === 'loading') {
    return <main aria-busy="true">Loading campaigns…</main>;
  }
  if (state !== 'ready' || campaigns.length === 0) {
    return <Navigate replace to="/campaigns" />;
  }

  const campaignId = campaigns.some(
    (campaign) => campaign.id === lastValidCampaignId,
  )
    ? lastValidCampaignId
    : campaigns[0]?.id;

  return campaignId ? (
    <Navigate
      replace
      to={`/campaigns/${encodeURIComponent(campaignId)}/overview`}
    />
  ) : (
    <Navigate replace to="/campaigns" />
  );
}
