import type { CampaignMap, MapPin } from '../ashes-of-veyra/types';
import { CROWN_CAMPAIGN_ID } from './campaign';

export const MAP_ASHGATE_ROYAL_QUARTER_ID = 'map-ashgate-royal-quarter';

const pinnedLocationIds = [
  'location-hall-of-nine-banners',
  'location-crown-vault',
  'location-ember-cloister',
  'location-gilded-exchange',
  'location-guttered-candle',
  'location-ashwater-quay',
  'location-ashen-catacombs',
];

export const crownMaps: CampaignMap[] = [
  {
    id: MAP_ASHGATE_ROYAL_QUARTER_ID,
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Ashgate Royal Quarter',
    description:
      'Working map of the Ashgate palace hill, guild districts and the grey-water quay. Placeholder art until a dedicated map is painted.',
    // No Crown-specific map art exists yet. Reuse the only public demo map
    // image so the map screen renders; replace with a dedicated asset later.
    imagePath: '/demo/ashes-of-veyra/glass-harbor-map.png',
    locationIds: pinnedLocationIds,
    layers: [
      {
        id: 'layer-crown-locations',
        label: 'Locations',
        visibleByDefault: true,
        locationIds: pinnedLocationIds,
      },
      {
        id: 'layer-crown-encounters',
        label: 'Encounters',
        visibleByDefault: true,
        locationIds: [
          'location-hall-of-nine-banners',
          'location-crown-vault',
          'location-guttered-candle',
          'location-ashen-catacombs',
        ],
      },
      {
        id: 'layer-crown-npcs',
        label: 'NPCs',
        visibleByDefault: true,
        locationIds: pinnedLocationIds,
      },
      {
        id: 'layer-crown-notes',
        label: 'Notes',
        visibleByDefault: true,
        locationIds: ['location-hall-of-nine-banners', 'location-ember-cloister'],
      },
      {
        id: 'layer-crown-environment',
        label: 'Environment',
        visibleByDefault: false,
        locationIds: ['location-hall-of-nine-banners', 'location-ashen-catacombs'],
      },
      {
        id: 'layer-crown-grid',
        label: 'Grid',
        visibleByDefault: false,
        locationIds: [],
      },
      {
        id: 'layer-crown-labels',
        label: 'Labels',
        visibleByDefault: false,
        locationIds: [],
      },
      {
        id: 'layer-crown-fog-of-war',
        label: 'Fog of War',
        visibleByDefault: false,
        locationIds: [],
      },
    ],
  },
];

export const crownMapPins: MapPin[] = [
  {
    id: 'pin-hall-of-nine-banners',
    mapId: MAP_ASHGATE_ROYAL_QUARTER_ID,
    locationId: 'location-hall-of-nine-banners',
    label: 'Hall of Nine Banners',
    order: 1,
    x: 0.5,
    y: 0.22,
    layerIds: [
      'layer-crown-locations',
      'layer-crown-encounters',
      'layer-crown-npcs',
      'layer-crown-notes',
      'layer-crown-environment',
    ],
    linkedObjectIds: [
      'encounter-cinder-wights-dais',
      'npc-the-crown',
      'handout-coronation-program',
      'scene-hall-of-nine-banners',
    ],
    selectedByDefault: true,
  },
  {
    id: 'pin-crown-vault',
    mapId: MAP_ASHGATE_ROYAL_QUARTER_ID,
    locationId: 'location-crown-vault',
    label: 'The Crown Vault',
    order: 2,
    x: 0.42,
    y: 0.34,
    layerIds: [
      'layer-crown-locations',
      'layer-crown-encounters',
      'layer-crown-npcs',
    ],
    linkedObjectIds: [
      'encounter-vault-guardians',
      'npc-tamsin-vell',
      'lore-burned-rulers-roll',
    ],
    selectedByDefault: false,
  },
  {
    id: 'pin-ember-cloister',
    mapId: MAP_ASHGATE_ROYAL_QUARTER_ID,
    locationId: 'location-ember-cloister',
    label: 'The Ember Cloister',
    order: 3,
    x: 0.68,
    y: 0.3,
    layerIds: [
      'layer-crown-locations',
      'layer-crown-npcs',
      'layer-crown-notes',
    ],
    linkedObjectIds: ['npc-halden-brack', 'faction-ember-wardens'],
    selectedByDefault: false,
  },
  {
    id: 'pin-gilded-exchange',
    mapId: MAP_ASHGATE_ROYAL_QUARTER_ID,
    locationId: 'location-gilded-exchange',
    label: 'The Gilded Exchange',
    order: 4,
    x: 0.3,
    y: 0.58,
    layerIds: ['layer-crown-locations', 'layer-crown-npcs'],
    linkedObjectIds: ['npc-oswin-pell', 'handout-sealed-genealogy'],
    selectedByDefault: false,
  },
  {
    id: 'pin-guttered-candle',
    mapId: MAP_ASHGATE_ROYAL_QUARTER_ID,
    locationId: 'location-guttered-candle',
    label: 'The Guttered Candle',
    order: 5,
    x: 0.55,
    y: 0.64,
    layerIds: [
      'layer-crown-locations',
      'layer-crown-encounters',
      'layer-crown-npcs',
    ],
    linkedObjectIds: [
      'encounter-guttered-candle-brawl',
      'npc-nell-soot',
      'scene-guttered-candle-cellar',
    ],
    selectedByDefault: false,
  },
  {
    id: 'pin-ashwater-quay',
    mapId: MAP_ASHGATE_ROYAL_QUARTER_ID,
    locationId: 'location-ashwater-quay',
    label: 'Ashwater Quay',
    order: 6,
    x: 0.78,
    y: 0.72,
    layerIds: ['layer-crown-locations', 'layer-crown-npcs'],
    linkedObjectIds: ['npc-courier-wren', 'handout-flame-signal-sketch'],
    selectedByDefault: false,
  },
  {
    id: 'pin-ashen-catacombs',
    mapId: MAP_ASHGATE_ROYAL_QUARTER_ID,
    locationId: 'location-ashen-catacombs',
    label: 'The Ashen Catacombs',
    order: 7,
    x: 0.72,
    y: 0.46,
    layerIds: [
      'layer-crown-locations',
      'layer-crown-encounters',
      'layer-crown-environment',
    ],
    linkedObjectIds: [
      'encounter-catacomb-ashbound',
      'npc-mother-cinder',
      'lore-unquenched-creed',
    ],
    selectedByDefault: false,
  },
];
