import { SectionRoute } from '@/features/section-shell/SectionRoute';
import { WorldSection } from '@/features/world/WorldSection';

export function WorldSectionRoute() {
  return (
    <SectionRoute title="World">
      <WorldSection />
    </SectionRoute>
  );
}
