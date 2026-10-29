import { SectionRoute } from '@/features/section-shell/SectionRoute';
import { QuestsSection } from '@/features/quests/QuestsSection';

export function QuestsSectionRoute() {
  return (
    <SectionRoute title="Quests">
      <QuestsSection />
    </SectionRoute>
  );
}
