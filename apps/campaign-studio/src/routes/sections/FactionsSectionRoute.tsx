import { SectionRoute } from '@/features/section-shell/SectionRoute';
import { FactionsSection } from '@/features/factions/FactionsSection';

export function FactionsSectionRoute() {
  return (
    <SectionRoute title="Factions">
      <FactionsSection />
    </SectionRoute>
  );
}
