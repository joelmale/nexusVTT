import { EmptyState } from '@/features/section-shell/EmptyState';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

export function QuestsSectionRoute() {
  return (
    <SectionRoute title="Quests">
      <main>
        <h1>Quests</h1>
        <EmptyState title="Coming soon" />
      </main>
    </SectionRoute>
  );
}
