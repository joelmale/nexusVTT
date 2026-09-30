import { useCapabilityNotice } from '@/features/capability-notice';
import { MapsIndex } from '@/features/maps/MapsIndex';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

function MapsContent() {
  const { bundle, basePath } = useSectionBundle();
  const { notifyCapability } = useCapabilityNotice();
  return (
    <main>
      <h1>Maps</h1>
      {bundle.maps.length === 0 ? (
        <EmptyState
          title="No maps yet."
          action={
            <button
              onClick={() => notifyCapability('map.asset.replace')}
              type="button"
            >
              Upload map
            </button>
          }
        />
      ) : (
        <MapsIndex basePath={basePath} bundle={bundle} />
      )}
    </main>
  );
}

export function MapsSectionRoute() {
  return (
    <SectionRoute title="Maps">
      <MapsContent />
    </SectionRoute>
  );
}
