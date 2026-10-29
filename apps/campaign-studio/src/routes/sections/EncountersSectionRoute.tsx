import { SectionRoute } from '@/features/section-shell/SectionRoute';
import { EncountersSection } from '@/features/encounters/EncountersSection';

export function EncountersSectionRoute() {
  return (
    <SectionRoute title="Encounters">
      <EncountersSection />
    </SectionRoute>
  );
}
