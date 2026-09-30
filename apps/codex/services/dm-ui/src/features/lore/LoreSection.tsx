import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';

import { FilterBar } from '@/features/section-shell/FilterBar';
import { SectionLayout } from '@/features/section-shell/SectionLayout';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionTabs } from '@/features/section-shell/SectionTabs';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';

import { HandoutsTab } from './HandoutsTab';
import { playerHandouts, resolveLoreRoute, type LoreTab } from './handoutsModels';
import { NotesBoard } from './NotesBoard';
import { buildNotesBoard, filterOptions } from './notesBoardModels';

interface LoreViewProps {
  tab?: string;
  itemId?: string;
}

/** Route-independent Lore page (tests render this directly). */
export function LoreView({ tab, itemId }: LoreViewProps) {
  const { bundle } = useSectionBundle();
  const route = resolveLoreRoute(tab, itemId, bundle);
  const tabs = (
    <SectionTabs
      activeTab={route.tab}
      ariaLabel="Lore sections"
      sectionPath="lore"
      tabs={[
        { id: 'notes', label: 'Notes', count: bundle.notes.length },
        {
          id: 'handouts',
          label: 'Handouts',
          count: playerHandouts(bundle).length,
        },
      ]}
    />
  );
  return route.tab === 'handouts' ? (
    <HandoutsTab selectedId={route.itemId} tabs={tabs} />
  ) : (
    <NotesTab selectedId={route.itemId} tabs={tabs} />
  );
}

function NotesTab({
  tabs,
  selectedId,
}: {
  tabs: ReactNode;
  selectedId?: string;
}) {
  const { bundle } = useSectionBundle();
  const { get } = useSectionQuery();
  const model = buildNotesBoard(bundle, get('anchor'), get('q'));
  return (
    <SectionLayout
      count={bundle.notes.length}
      empty={
        <div role="tabpanel" aria-label="Notes">
          <FilterBar
            facets={[
              {
                key: 'anchor',
                label: 'Show',
                allLabel: 'All notes',
                options: filterOptions(bundle),
              },
            ]}
            plural="notes"
            resultCount={model.visible.length}
            searchLabel="Search notes"
            singular="note"
          />
          <NotesBoard model={model} selectedId={selectedId} />
        </div>
      }
      list={null}
      sectionPath="lore/notes"
      tabs={tabs}
      title="Lore"
    />
  );
}

export function LoreSection() {
  const { tab, itemId } = useParams();
  return <LoreView itemId={itemId} tab={tab as LoreTab | undefined} />;
}
