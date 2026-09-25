import { useMemo } from 'react';

import {
  encounters,
  handouts,
  locations,
  mapPins,
  maps,
  npcs,
} from '@/demo/ashes-of-veyra';
import { useCapabilityNotice } from '@/features/capability-notice';
import { MapPreparation } from '@/features/map-preparation/MapPreparation';
import type {
  LinkedObjectViewModel,
  MapPreparationViewModel,
} from '@/features/map-preparation/mapPreparationModels';
import { StudioFrame } from '@/features/studio-shell/StudioFrame';

const SCENE_TITLES: Record<string, string> = {
  'scene-glass-harbor-docks': 'Glass Harbor Docks',
  'scene-harbor-warehouse-template': 'Harbor Warehouse scene template',
  'scene-salty-mast-cellar': 'Salty Mast Cellar',
};

function resolvePublicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

function resolveLinkedObject(objectId: string): LinkedObjectViewModel {
  const npc = npcs.find((item) => item.id === objectId);
  if (npc) {
    return { id: npc.id, kind: 'NPC', subtitle: npc.role, title: npc.name };
  }
  const encounter = encounters.find((item) => item.id === objectId);
  if (encounter) {
    const totalCreatures = encounter.composition.reduce(
      (total, creature) => total + creature.count,
      0,
    );
    return {
      id: encounter.id,
      kind: 'Encounter',
      subtitle: `${totalCreatures} participants - ${encounter.difficulty}`,
      title: encounter.title,
    };
  }
  const handout = handouts.find((item) => item.id === objectId);
  if (handout) {
    return {
      id: handout.id,
      kind: handout.kind === 'lore' ? 'Lore' : 'Handout',
      subtitle: handout.visibility === 'shared' ? 'Player ready' : 'DM only',
      title: handout.title,
    };
  }
  return {
    id: objectId,
    kind: 'Scene',
    subtitle: 'Scene template',
    title: SCENE_TITLES[objectId] ?? objectId.replace(/-/g, ' '),
  };
}

function buildMapModel(): MapPreparationViewModel {
  const map = maps[0];
  if (!map) throw new Error('Ashes of Veyra map fixture is missing.');

  return {
    id: map.id,
    imagePath: resolvePublicAsset(map.imagePath),
    layers: map.layers.map((layer) => ({
      id: layer.id,
      label: layer.label,
      visible: layer.visibleByDefault,
    })),
    locations: mapPins.map((pin) => {
      const location = locations.find((item) => item.id === pin.locationId);
      if (!location)
        throw new Error(`Missing location fixture: ${pin.locationId}`);
      return {
        description: location.description,
        id: location.id,
        imagePath: location.imagePath
          ? resolvePublicAsset(location.imagePath)
          : undefined,
        linkedObjects: pin.linkedObjectIds.map(resolveLinkedObject),
        name: location.name,
        notes: location.notes,
        shortDescription: location.shortDescription,
        tags: location.tags,
        typeLabel: location.type.replace('-', ' '),
      };
    }),
    pins: mapPins.map((pin) => ({
      id: pin.id,
      label: pin.label,
      layerIds: pin.layerIds,
      locationId: pin.locationId,
      x: pin.x,
      y: pin.y,
    })),
    selectedPinId:
      mapPins.find((pin) => pin.selectedByDefault)?.id ?? mapPins[0]?.id ?? '',
    title: 'Glass Harbor',
  };
}

export function MapPreparationRoute() {
  const { notifyCapability } = useCapabilityNotice();
  const model = useMemo(buildMapModel, []);

  return (
    <StudioFrame
      contextLabel="Glass Harbor"
      onCapability={notifyCapability}
      onSearch={() => notifyCapability('campaign.search')}
      onSettings={() => notifyCapability('campaign.settings.open')}
      onTheme={() => notifyCapability('campaign.theme.change')}
    >
      <MapPreparation model={model} onCapability={notifyCapability} />
    </StudioFrame>
  );
}
