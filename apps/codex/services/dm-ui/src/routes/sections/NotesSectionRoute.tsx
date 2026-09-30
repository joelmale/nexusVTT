import { NotesSection } from '@/features/notes/NotesSection';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

export function NotesSectionRoute() {
  return (
    <SectionRoute title="Notes">
      <NotesSection />
    </SectionRoute>
  );
}
