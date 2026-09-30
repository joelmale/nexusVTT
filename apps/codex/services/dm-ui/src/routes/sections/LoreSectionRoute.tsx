import { LoreSection } from '@/features/lore/LoreSection';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

export function LoreSectionRoute() {
  return (
    <SectionRoute title="Lore">
      <LoreSection />
    </SectionRoute>
  );
}
