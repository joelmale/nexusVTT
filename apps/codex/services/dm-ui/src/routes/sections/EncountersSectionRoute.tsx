import { EmptyState } from '@/features/section-shell/EmptyState';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

export function EncountersSectionRoute() {
  return (
    <SectionRoute title="Encounters">
      <main>
        <h1>Encounters</h1>
        <EmptyState title="Coming soon" />
      </main>
    </SectionRoute>
  );
}
