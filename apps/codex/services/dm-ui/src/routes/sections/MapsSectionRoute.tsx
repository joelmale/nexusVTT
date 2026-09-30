import { EmptyState } from '@/features/section-shell/EmptyState';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

export function MapsSectionRoute() {
  return (
    <SectionRoute title="Maps">
      <main>
        <h1>Maps</h1>
        <EmptyState title="Coming soon" />
      </main>
    </SectionRoute>
  );
}
