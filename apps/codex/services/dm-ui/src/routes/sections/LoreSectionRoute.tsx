import { EmptyState } from '@/features/section-shell/EmptyState';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

export function LoreSectionRoute() {
  return (
    <SectionRoute title="Lore">
      <main>
        <h1>Lore</h1>
        <EmptyState title="Coming soon" />
      </main>
    </SectionRoute>
  );
}
