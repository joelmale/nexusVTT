import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useCapabilityNotice } from '@/features/capability-notice';
import { buildMapPreparationModel } from '@/features/map-preparation/buildMapPreparationModel';
import { MapPreparation } from '@/features/map-preparation/MapPreparation';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

function MapPreparationContent() {
  const { notifyCapability } = useCapabilityNotice();
  const { bundle, basePath } = useSectionBundle();
  const { mapId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const pinId = searchParams.get('pin');
  const model = useMemo(
    () => buildMapPreparationModel(bundle, mapId, pinId),
    [bundle, mapId, pinId],
  );

  if (!model) {
    return (
      <main>
        <h1>Map not found</h1>
        <EmptyState
          title="This map does not exist in this campaign."
          action={<Link to={`${basePath}/maps`}>Back to Maps</Link>}
        />
      </main>
    );
  }

  return (
    <MapPreparation
      // Remount when the map or requested pin changes so initial state resets.
      key={`${model.id}:${model.selectedPinId}`}
      basePath={basePath}
      model={model}
      onCapability={notifyCapability}
    />
  );
}

export function MapPreparationRoute() {
  return (
    <SectionRoute title="Maps">
      <MapPreparationContent />
    </SectionRoute>
  );
}
