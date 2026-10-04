import type { CampaignFixtureBundle } from '@/demo/fixture-registry';

import type {
  LinkedObjectViewModel,
  MapPreparationViewModel,
} from './mapPreparationModels';

export function resolvePublicAsset(path: string): string {
  if (
    path.startsWith('data:') ||
    path.startsWith('blob:') ||
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path;
  }
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

export function resolveMapImage(map: { imagePath?: string; imageAssetRef?: { assetId: string } }): string {
  if (map.imagePath) return resolvePublicAsset(map.imagePath);
  const assetId = map.imageAssetRef?.assetId;
  if (!assetId) return '';
  if (assetId.startsWith('http://') || assetId.startsWith('https://') || assetId.startsWith('/')) {
    return assetId;
  }
  if (assetId.startsWith('demo-')) {
    return resolvePublicAsset('/campaigns/ashes-of-veyra/maps/glass-harbor.png');
  }
  if (assetId.startsWith('library:')) {
    return `/library-assets/${assetId.slice('library:'.length)}`;
  }
  return `/api/assets/${assetId}`;
}

export function resolveLinkedObject(
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
  const location = bundle.locations.find((item) => item.id === objectId);
  if (location) {
    return {
      id: location.id,
      kind: 'Location',
      subtitle: location.type.replace('-', ' '),
      title: location.name,
    };
  }
  const quest = bundle.quests.find((item) => item.id === objectId);
  if (quest) {
    return {
      id: quest.id,
      kind: 'Quest',
      subtitle: `${quest.status} · ${quest.priority} priority`,
      title: quest.title,
    };
  }
  const note = bundle.notes.find((item) => item.id === objectId);
  if (note) {
    return {
      id: note.id,
      kind: 'Note',
      subtitle: note.audience === 'none' ? 'DM only' : 'Shared',
      title: note.title,
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

  const availableObjects: LinkedObjectViewModel[] = [
    ...bundle.locations.map((loc) => ({
      id: loc.id,
      kind: 'Location',
      title: loc.name,
      subtitle: loc.type.replace('-', ' '),
    })),
    ...bundle.npcs.map((npc) => ({
      id: npc.id,
      kind: 'NPC',
      title: npc.name,
      subtitle: npc.role,
    })),
    ...bundle.encounters.map((enc) => ({
      id: enc.id,
      kind: 'Encounter',
      title: enc.title,
      subtitle: enc.difficulty,
    })),
    ...bundle.quests.map((q) => ({
      id: q.id,
      kind: 'Quest',
      title: q.title,
      subtitle: q.status,
    })),
    ...bundle.notes.map((n) => ({
      id: n.id,
      kind: 'Note',
      title: n.title,
      subtitle: n.audience === 'none' ? 'DM only' : 'Shared',
    })),
    ...bundle.handouts.map((h) => ({
      id: h.id,
      kind: h.kind === 'lore' ? 'Lore' : 'Handout',
      title: h.title,
      subtitle: h.visibility === 'shared' ? 'Player ready' : 'DM only',
    })),
    ...bundle.sceneTemplates.map((s) => ({
      id: s.id,
      kind: 'Scene',
      title: s.title,
      subtitle: 'Scene template',
    })),
  ];

  return {
    id: map.id,
    title: map.title,
    description: map.description,
    imagePath: resolveMapImage(map),
    imageAssetRef: map.imageAssetRef as MapPreparationViewModel['imageAssetRef'],
    dimensions: map.dimensions,
    layers: map.layers.map((layer) => ({
      id: layer.id,
      label: layer.label,
      visible: layer.visibleByDefault,
      order: layer.order,
    })),
    locations,
    availableObjects,
    pins: pins.map((pin) => ({
      id: pin.id,
      label: pin.label,
      layerIds: pin.layerIds,
      locationId: pin.locationId,
      x: pin.x,
      y: pin.y,
      icon: pin.icon,
      color: pin.color,
      visibility: pin.visibility,
      notes: pin.notes,
      linkedObjectRefs: pin.linkedObjectRefs,
      linkedObjects: (pin.linkedObjectIds ?? []).map((id) =>
        resolveLinkedObject(bundle, id),
      ),
    })),
    selectedPinId:
      requestedPin?.id ??
      pins.find((pin) => pin.selectedByDefault)?.id ??
      pins[0]?.id ??
      '',
  };
}
