import type { CampaignMap, MapPin } from '../ashes-of-veyra/types';
import { KHARAD_CAMPAIGN_ID } from './campaign';

export const MAP_BURIED_CONSTELLATION_ID = 'map-buried-constellation';

/**
 * No Kharad-specific map artwork exists yet. Following the "do not fabricate
 * binary assets" rule, this reuses the existing Ashes of Veyra placeholder
 * image, which the map preparation view already loads for demo campaigns.
 */
export const KHARAD_MAP_IMAGE_PATH =
  '/demo/ashes-of-veyra/glass-harbor-map.png';

const allLocationIds = [
  'location-kharad-mine',
  'location-singing-fault',
  'location-inverted-observatory',
  'location-broken-gate-hall',
  'location-transit-line',
  'location-zero-gravity-vault',
  'location-engine-heart',
  'location-kharad-commons',
];

export const kharadMaps: CampaignMap[] = [
  {
    id: MAP_BURIED_CONSTELLATION_ID,
    campaignId: KHARAD_CAMPAIGN_ID,
    title: 'The Buried Constellation',
    description:
      'Cutaway map of Kharad and the seven-hold constellation, from the mine head down to the engine heart.',
    imagePath: KHARAD_MAP_IMAGE_PATH,
    locationIds: allLocationIds,
    layers: [
      {
        id: 'layer-kharad-locations',
        label: 'Locations',
        visibleByDefault: true,
        locationIds: allLocationIds,
      },
      {
        id: 'layer-kharad-encounters',
        label: 'Encounters',
        visibleByDefault: true,
        locationIds: allLocationIds.filter(
          (id) => id !== 'location-kharad-mine',
        ),
      },
      {
        id: 'layer-kharad-npcs',
        label: 'NPCs',
        visibleByDefault: true,
        locationIds: allLocationIds,
      },
      {
        id: 'layer-kharad-notes',
        label: 'Notes',
        visibleByDefault: true,
        locationIds: ['location-engine-heart', 'location-kharad-commons'],
      },
      {
        id: 'layer-kharad-environment',
        label: 'Environment',
        visibleByDefault: true,
        locationIds: [
          'location-singing-fault',
          'location-zero-gravity-vault',
          'location-transit-line',
        ],
      },
      {
        id: 'layer-kharad-grid',
        label: 'Grid',
        visibleByDefault: false,
        locationIds: [],
      },
      {
        id: 'layer-kharad-labels',
        label: 'Labels',
        visibleByDefault: false,
        locationIds: [],
      },
      {
        id: 'layer-kharad-fog-of-war',
        label: 'Fog of War',
        visibleByDefault: false,
        locationIds: [],
      },
    ],
  },
];

const standardLayers = [
  'layer-kharad-locations',
  'layer-kharad-encounters',
  'layer-kharad-npcs',
];

export const kharadMapPins: MapPin[] = [
  {
    id: 'pin-kharad-mine',
    mapId: MAP_BURIED_CONSTELLATION_ID,
    locationId: 'location-kharad-mine',
    label: 'Kharad Mine',
    order: 1,
    x: 0.5,
    y: 0.1,
    layerIds: ['layer-kharad-locations', 'layer-kharad-npcs'],
    linkedObjectIds: ['npc-tamsin-brack', 'handout-survey-crew-log'],
    selectedByDefault: false,
  },
  {
    id: 'pin-singing-fault',
    mapId: MAP_BURIED_CONSTELLATION_ID,
    locationId: 'location-singing-fault',
    label: 'The Singing Fault',
    order: 2,
    x: 0.3,
    y: 0.25,
    layerIds: [...standardLayers, 'layer-kharad-environment'],
    linkedObjectIds: [
      'encounter-resonant-fault-collapse',
      'npc-yarrow-stonesinger',
    ],
    selectedByDefault: false,
  },
  {
    id: 'pin-inverted-observatory',
    mapId: MAP_BURIED_CONSTELLATION_ID,
    locationId: 'location-inverted-observatory',
    label: 'The Inverted Observatory',
    order: 3,
    x: 0.68,
    y: 0.28,
    layerIds: standardLayers,
    linkedObjectIds: [
      'encounter-survey-crew-defense',
      'handout-inverted-star-chart',
      'npc-pell-quartz',
    ],
    selectedByDefault: false,
  },
  {
    id: 'pin-broken-gate-hall',
    mapId: MAP_BURIED_CONSTELLATION_ID,
    locationId: 'location-broken-gate-hall',
    label: 'Hall of the Broken Gate',
    order: 4,
    x: 0.42,
    y: 0.45,
    layerIds: standardLayers,
    linkedObjectIds: [
      'encounter-council-at-broken-gate',
      'npc-hrolda-ironvein',
      'handout-concord-writ-of-custodianship',
    ],
    selectedByDefault: false,
  },
  {
    id: 'pin-transit-line',
    mapId: MAP_BURIED_CONSTELLATION_ID,
    locationId: 'location-transit-line',
    label: 'The Transit Line',
    order: 5,
    x: 0.72,
    y: 0.55,
    layerIds: [...standardLayers, 'layer-kharad-environment'],
    linkedObjectIds: [
      'encounter-transit-line-chase',
      'encounter-ordrun-station-ambush',
      'npc-vessa-ordrun',
    ],
    selectedByDefault: false,
  },
  {
    id: 'pin-zero-gravity-vault',
    mapId: MAP_BURIED_CONSTELLATION_ID,
    locationId: 'location-zero-gravity-vault',
    label: 'The Zero-Gravity Vault',
    order: 6,
    x: 0.3,
    y: 0.7,
    layerIds: [...standardLayers, 'layer-kharad-environment'],
    linkedObjectIds: ['encounter-zero-gravity-vault', 'npc-the-astronomer'],
    selectedByDefault: false,
  },
  {
    id: 'pin-engine-heart',
    mapId: MAP_BURIED_CONSTELLATION_ID,
    locationId: 'location-engine-heart',
    label: 'The Engine Heart',
    order: 7,
    x: 0.5,
    y: 0.86,
    layerIds: [...standardLayers, 'layer-kharad-notes'],
    linkedObjectIds: [
      'encounter-astronomer-awakens',
      'encounter-fate-of-the-vessel',
      'lore-star-engine-purpose',
    ],
    selectedByDefault: true,
  },
  {
    id: 'pin-kharad-commons',
    mapId: MAP_BURIED_CONSTELLATION_ID,
    locationId: 'location-kharad-commons',
    label: 'The Commons of Seven Chalks',
    order: 8,
    x: 0.82,
    y: 0.82,
    layerIds: [...standardLayers, 'layer-kharad-notes'],
    linkedObjectIds: [
      'handout-epilogue-proclamation',
      'lore-legacy-of-kharad',
      'npc-ilsa-vaunt',
    ],
    selectedByDefault: false,
  },
];
