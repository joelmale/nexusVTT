import { EmptyState } from '@/features/section-shell/EmptyState';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

export function SessionsSectionRoute() {
  return (
    <SectionRoute title="Sessions">
      <main>
        <h1>Sessions</h1>
        <EmptyState title="Coming soon" />
      </main>
    </SectionRoute>
  );
}
