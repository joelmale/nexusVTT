import { SectionRoute } from '@/features/section-shell/SectionRoute';
import { NpcsSection } from '@/features/npcs/NpcsSection';

export function NpcsSectionRoute() {
  return (
    <SectionRoute title="NPCs">
      <NpcsSection />
    </SectionRoute>
  );
}
