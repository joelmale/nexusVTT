import { useParams } from 'react-router-dom';

import {
  getVisibleCampaignCatalog,
  type CampaignCatalogEntry,
} from '@/demo/campaign-catalog';
import { CampaignOverview } from '@/features/campaign-overview/campaign-overview';
import { FixtureCampaignOverview } from '@/features/campaign-overview/FixtureCampaignOverview';
import { useCapabilityNotice } from '@/features/capability-notice';
import { StudioFrame } from '@/features/studio-shell/StudioFrame';

function findVisibleCampaignFixture(
  fixtureSlug: string | undefined,
  mode: string = import.meta.env.MODE,
): CampaignCatalogEntry | undefined {
  return getVisibleCampaignCatalog(mode).find(
    (entry) => entry.slug === fixtureSlug,
  );
}

export function DemoCampaignOverviewRoute() {
  const { fixtureSlug } = useParams();
  const { notifyCapability } = useCapabilityNotice();
  const fixture = findVisibleCampaignFixture(fixtureSlug);

  if (!fixture) {
    return (
      <StudioFrame onCapability={notifyCapability}>
        <main>
          <h1>Example campaign unavailable</h1>
          <p>This fixture is not available in the current build.</p>
        </main>
      </StudioFrame>
    );
  }

  if (fixture.fixtureSource === 'full-demo') return <CampaignOverview />;

  return <FixtureCampaignOverview fixture={fixture} />;
}
