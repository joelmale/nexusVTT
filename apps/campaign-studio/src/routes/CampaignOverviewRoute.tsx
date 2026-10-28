import { CampaignOverview } from '@/features/campaign-overview/campaign-overview';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

export function CampaignOverviewRoute() {
  return (
    <SectionRoute>
      <CampaignOverview />
    </SectionRoute>
  );
}
