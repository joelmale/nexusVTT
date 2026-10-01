import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useCapabilityNotice } from '@/features/capability-notice';
import { buildMapPreparationModel } from '@/features/map-preparation/buildMapPreparationModel';
import { MapPreparation } from '@/features/map-preparation/MapPreparation';
import type {
  MapPinViewModel,
  MapPreparationViewModel,
} from '@/features/map-preparation/mapPreparationModels';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionRoute } from '@/features/section-shell/SectionRoute';
import { createSceneTemplateFromMap } from '@/services/campaign-prep-api';

function MapPreparationContent() {
  const { notifyCapability } = useCapabilityNotice();
  const { bundle, basePath, store } = useSectionBundle();
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

  const handleSave = async (updatedMap: Record<string, unknown>) => {
    if (!store.editable) return;
    await store.updateItem('campaign-map', model.id, updatedMap);
  };

  const handleCreateScene = async (
    mapModel: MapPreparationViewModel,
    selectedPin?: MapPinViewModel,
  ) => {
    if (!store.editable) {
      notifyCapability('map.scene.create');
      return;
    }
    const assetId =
      mapModel.imageAssetRef?.assetId ||
      (mapModel.imagePath ? `library:${mapModel.id}` : 'library:default-map');
    await createSceneTemplateFromMap({
      campaignId: String(bundle.campaignId),
      mapTitle: mapModel.title,
      assetId,
      pinLabel: selectedPin?.label,
    });
    await store.reload();
  };

  const handleCreateLocation = async (name: string) => {
    if (!store.editable) {
      return { id: crypto.randomUUID(), title: name };
    }
    const result = await store.addItem('location', {
      name,
      type: 'landmark',
      shortDescription: '',
      description: [],
      tags: [],
      notes: '',
    });
    return {
      id: result.id ?? crypto.randomUUID(),
      title: name,
    };
  };

  return (
    <MapPreparation
      key={`${model.id}:${model.selectedPinId}`}
      basePath={basePath}
      editable={store.editable}
      model={model}
      onCapability={notifyCapability}
      onCreateLocation={store.editable ? handleCreateLocation : undefined}
      onCreateScene={handleCreateScene}
      onSave={store.editable ? handleSave : undefined}
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
