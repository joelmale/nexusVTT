import { SectionRoute } from '@/features/section-shell/SectionRoute';
import { ItemsSection } from '@/features/items/ItemsSection';

export function ItemsSectionRoute() {
  return (
    <SectionRoute title="Items">
      <ItemsSection />
    </SectionRoute>
  );
}
