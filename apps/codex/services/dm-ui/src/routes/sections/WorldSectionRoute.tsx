import { EmptyState } from '@/features/section-shell/EmptyState';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

export function WorldSectionRoute() {
  return (
    <SectionRoute title="World">
      <main>
        <h1>World</h1>
        <EmptyState title="Coming soon" />
      </main>
    </SectionRoute>
  );
}
