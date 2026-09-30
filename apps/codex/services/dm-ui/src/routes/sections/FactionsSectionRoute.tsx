import { EmptyState } from '@/features/section-shell/EmptyState';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

export function FactionsSectionRoute() {
  return (
    <SectionRoute title="Factions">
      <main>
        <h1>Factions</h1>
        <EmptyState title="Coming soon" />
      </main>
    </SectionRoute>
  );
}
