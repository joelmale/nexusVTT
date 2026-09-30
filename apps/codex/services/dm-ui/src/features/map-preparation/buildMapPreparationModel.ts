import type { CampaignFixtureBundle } from '@/demo/fixture-registry';

import type {
  LinkedObjectViewModel,
  MapPreparationViewModel,
} from './mapPreparationModels';

export function resolvePublicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

function resolveLinkedObject(
  bundle: CampaignFixtureBundle,
  objectId: string,
): LinkedObjectViewModel {
  const npc = bundle.npcs.find((item) => item.id === objectId);
  if (npc) {
    return { id: npc.id, kind: 'NPC', subtitle: npc.role, title: npc.name };
  }
  const encounter = bundle.encounters.find((item) => item.id === objectId);
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
  const handout = bundle.handouts.find((item) => item.id === objectId);
  if (handout) {
    return {
      id: handout.id,
      kind: handout.kind === 'lore' ? 'Lore' : 'Handout',
      subtitle: handout.visibility === 'shared' ? 'Player ready' : 'DM only',
      title: handout.title,
    };
  }
  const scene = bundle.sceneTemplates.find((item) => item.id === objectId);
  return {
    id: objectId,
    kind: 'Scene',
    subtitle: 'Scene template',
    title: scene?.title ?? objectId.replace(/-/g, ' '),
  };
}

/** Builds the prep-workspace model for one map, or undefined if it is unknown. */
export function buildMapPreparationModel(
  bundle: CampaignFixtureBundle,
  mapId: string,
  pinId?: string | null,
): MapPreparationViewModel | undefined {
  const map = bundle.maps.find((item) => item.id === mapId);
  if (!map) return undefined;

  const pins = bundle.pins
    .filter((pin) => pin.mapId === map.id)
    .sort((a, b) => a.order - b.order);
  const locationIds = new Set(pins.map((pin) => pin.locationId));
  const locations = bundle.locations
    .filter((location) => locationIds.has(location.id))
    .map((location) => ({
      description: location.description,
      id: location.id,
      imagePath: location.imagePath
        ? resolvePublicAsset(location.imagePath)
        : undefined,
      linkedObjects: pins
        .filter((pin) => pin.locationId === location.id)
        .flatMap((pin) => pin.linkedObjectIds)
        .map((id) => resolveLinkedObject(bundle, id)),
      name: location.name,
      notes: location.notes,
      shortDescription: location.shortDescription,
      tags: location.tags,
      typeLabel: location.type.replace('-', ' '),
    }));

  const requestedPin = pinId ? pins.find((pin) => pin.id === pinId) : undefined;
  return {
    id: map.id,
    imagePath: map.imagePath ? resolvePublicAsset(map.imagePath) : '',
    layers: map.layers.map((layer) => ({
      id: layer.id,
      label: layer.label,
      visible: layer.visibleByDefault,
    })),
    locations,
    pins: pins.map((pin) => ({
      id: pin.id,
      label: pin.label,
      layerIds: pin.layerIds,
      locationId: pin.locationId,
      x: pin.x,
      y: pin.y,
    })),
    selectedPinId:
      requestedPin?.id ??
      pins.find((pin) => pin.selectedByDefault)?.id ??
      pins[0]?.id ??
      '',
    title: map.title,
  };
}
