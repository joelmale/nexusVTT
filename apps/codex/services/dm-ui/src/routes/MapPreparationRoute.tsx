import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useCapabilityNotice } from '@/features/capability-notice';
import { buildMapPreparationModel } from '@/features/map-preparation/buildMapPreparationModel';
import { MapPreparation } from '@/features/map-preparation/MapPreparation';
import {
  ReplaceMapImage,
  type MapImageChoice,
} from '@/features/map-preparation/ReplaceMapImage';
import type {
  MapPinViewModel,
  MapPreparationViewModel,
} from '@/features/map-preparation/mapPreparationModels';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { RemoveItemButton } from '@/features/section-shell/RemoveItemButton';
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
    const result = await store.updateItem('campaign-map', model.id, updatedMap);
    // MapPreparation serializes saves, so each call sees the revision the
    // previous one produced. Surface failures so it can show a retry.
    if (!result.ok) {
      throw new Error(
        result.conflict
          ? 'This map changed elsewhere.'
          : (result.error ?? 'Could not save the map.'),
      );
    }
  };

  // Points the map at another asset. imagePath is what buildData persists as
  // the display URL; dimensions only change when the new size is known.
  const handleReplaceImage = async (choice: MapImageChoice) => {
    const result = await store.updateItem('campaign-map', model.id, {
      imageAssetRef: { target: 'asset', assetId: choice.assetId },
      imagePath: choice.url,
      ...(choice.dimensions ? { dimensions: choice.dimensions } : {}),
    });
    if (!result.ok) {
      throw new Error(
        result.conflict
          ? 'This map changed elsewhere.'
          : (result.error ?? 'Could not replace the image.'),
      );
    }
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
      headerActions={
        <>
          {store.editable ? (
            <ReplaceMapImage onReplace={handleReplaceImage} />
          ) : null}
          <RemoveItemButton
            id={model.id}
            kind="campaign-map"
            label={model.title}
            listPath="maps"
          />
        </>
      }
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
