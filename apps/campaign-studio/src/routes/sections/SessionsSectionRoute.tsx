import { SectionRoute } from '@/features/section-shell/SectionRoute';
import { SessionsSection } from '@/features/sessions/SessionsSection';

export function SessionsSectionRoute() {
  return (
    <SectionRoute title="Sessions">
      <SessionsSection />
    </SectionRoute>
  );
}
