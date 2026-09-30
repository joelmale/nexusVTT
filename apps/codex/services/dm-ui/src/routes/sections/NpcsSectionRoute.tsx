import { EmptyState } from '@/features/section-shell/EmptyState';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

export function NpcsSectionRoute() {
  return (
    <SectionRoute title="NPCs">
      <main>
        <h1>NPCs</h1>
        <EmptyState title="Coming soon" />
      </main>
    </SectionRoute>
  );
}
