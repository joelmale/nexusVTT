import { AssetsSection } from '@/features/assets/AssetsSection';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

export function AssetsSectionRoute() {
  return (
    <SectionRoute title="Assets">
      <AssetsSection />
    </SectionRoute>
  );
}
