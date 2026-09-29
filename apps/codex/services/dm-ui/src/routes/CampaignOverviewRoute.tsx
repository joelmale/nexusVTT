import { BlankCampaignOverview } from '@/features/campaign-overview/BlankCampaignOverview';
import { useCampaignContext } from '@/features/campaigns/CampaignContext';
import { useCapabilityNotice } from '@/features/capability-notice';
import { StudioFrame } from '@/features/studio-shell/StudioFrame';

export function CampaignOverviewRoute() {
  const { activeCampaign, error, reload, state } = useCampaignContext();
  const { notifyCapability } = useCapabilityNotice();

  if (state === 'loading') {
    return <main aria-busy="true">Loading campaign…</main>;
  }

  if (!activeCampaign) {
    return (
      <StudioFrame onCapability={notifyCapability}>
        <main>
          <h1>Campaign unavailable</h1>
          <p>
            {error ??
              'This campaign was deleted, is inaccessible, or does not exist.'}
          </p>
          <button onClick={() => void reload()} type="button">
            Retry
          </button>
        </main>
      </StudioFrame>
    );
  }

  return (
    <StudioFrame
      contextLabel={activeCampaign.name}
      onCapability={notifyCapability}
      onSearch={() => notifyCapability('campaign.search')}
      onSettings={() => notifyCapability('campaign.settings.open')}
      onTheme={() => notifyCapability('campaign.theme.change')}
    >
      <BlankCampaignOverview campaign={activeCampaign} />
    </StudioFrame>
  );
}
