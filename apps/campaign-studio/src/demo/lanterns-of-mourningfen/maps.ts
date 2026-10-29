import type { CampaignMap, FixtureId, MapLayer, MapPin } from '../ashes-of-veyra/types';
import { MOURNINGFEN_CAMPAIGN_ID } from './campaign';
import { MAP_HOMESTEAD_ID, MAP_MARSH_ID } from './locations';

/**
 * No Mourningfen map artwork exists yet. Until one is added under
 * `public/demo/lanterns-of-mourningfen/`, both maps reuse the only shipped
 * demo map image (the Ashes of Veyra harbor map) as a placeholder. Swap this
 * one constant when real art lands.
 */
export const MOURNINGFEN_PLACEHOLDER_MAP_IMAGE =
  '/demo/ashes-of-veyra/glass-harbor-map.png';

const marshLocationIds: FixtureId[] = [
  'location-mourningfen-village',
  'location-crossing-ferry-landing',
  'location-drowned-shrine',
  'location-reedcutters-rest',
  'location-wardens-lamp-house',
  'location-eel-market',
];

const homesteadLocationIds: FixtureId[] = [
  'location-verrow-homestead',
  'location-homestead-nursery',
  'location-verrow-well',
];

function buildLayers(
  prefix: string,
  all: FixtureId[],
  notes: FixtureId[],
  environment: FixtureId[],
): MapLayer[] {
  return [
    { id: `${prefix}-locations`, label: 'Locations', visibleByDefault: true, locationIds: all },
    { id: `${prefix}-encounters`, label: 'Encounters', visibleByDefault: true, locationIds: all },
    { id: `${prefix}-npcs`, label: 'NPCs', visibleByDefault: true, locationIds: all },
    { id: `${prefix}-notes`, label: 'Notes', visibleByDefault: true, locationIds: notes },
    { id: `${prefix}-environment`, label: 'Environment', visibleByDefault: true, locationIds: environment },
    { id: `${prefix}-grid`, label: 'Grid', visibleByDefault: false, locationIds: [] },
    { id: `${prefix}-labels`, label: 'Labels', visibleByDefault: false, locationIds: [] },
    { id: `${prefix}-fog-of-war`, label: 'Fog of War', visibleByDefault: false, locationIds: [] },
  ];
}

export const maps: CampaignMap[] = [
  {
    id: MAP_MARSH_ID,
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Mourningfen Marsh',
    description:
      'Working map of the village, ferry route, drowned shrine, and the boardwalks that connect them. Placeholder artwork.',
    imagePath: MOURNINGFEN_PLACEHOLDER_MAP_IMAGE,
    locationIds: marshLocationIds,
    layers: buildLayers(
      'mf-marsh',
      marshLocationIds,
      ['location-mourningfen-village', 'location-wardens-lamp-house'],
      ['location-crossing-ferry-landing', 'location-drowned-shrine'],
    ),
  },
  {
    id: MAP_HOMESTEAD_ID,
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Verrow Homestead',
    description:
      'Floor plan of the forgotten homestead as it appears when the portraits are restored, with the well at the back. Placeholder artwork.',
    imagePath: MOURNINGFEN_PLACEHOLDER_MAP_IMAGE,
    locationIds: homesteadLocationIds,
    layers: buildLayers(
      'mf-homestead',
      homesteadLocationIds,
      ['location-homestead-nursery', 'location-verrow-well'],
      ['location-verrow-well'],
    ),
  },
];

const marshLayers = ['mf-marsh-locations', 'mf-marsh-encounters', 'mf-marsh-npcs'];
const homesteadLayers = [
  'mf-homestead-locations',
  'mf-homestead-encounters',
  'mf-homestead-npcs',
];

export const mapPins: MapPin[] = [
  {
    id: 'pin-mf-village',
    mapId: MAP_MARSH_ID,
    locationId: 'location-mourningfen-village',
    label: 'Mourningfen Village',
    order: 1,
    x: 0.5,
    y: 0.46,
    layerIds: [...marshLayers, 'mf-marsh-notes'],
    linkedObjectIds: [
      'npc-hesper-crane',
      'npc-bettin-sallow',
      'handout-births-register-extract',
    ],
    selectedByDefault: true,
  },
  {
    id: 'pin-mf-ferry-landing',
    mapId: MAP_MARSH_ID,
    locationId: 'location-crossing-ferry-landing',
    label: 'Crossing Ferry Landing',
    order: 2,
    x: 0.2,
    y: 0.62,
    layerIds: [...marshLayers, 'mf-marsh-environment'],
    linkedObjectIds: [
      'npc-odo-tarn',
      'encounter-lantern-loop',
      'handout-ferrymans-lantern-tag',
    ],
    selectedByDefault: false,
  },
  {
    id: 'pin-mf-shrine',
    mapId: MAP_MARSH_ID,
    locationId: 'location-drowned-shrine',
    label: 'The Drowned Shrine',
    order: 3,
    x: 0.3,
    y: 0.3,
    layerIds: [...marshLayers, 'mf-marsh-environment'],
    linkedObjectIds: [
      'npc-ysolde-verrow',
      'encounter-reedbound-procession',
      'lore-reedbound-procession',
    ],
    selectedByDefault: false,
  },
  {
    id: 'pin-mf-reedcutters',
    mapId: MAP_MARSH_ID,
    locationId: 'location-reedcutters-rest',
    label: "Reedcutters' Rest",
    order: 4,
    x: 0.62,
    y: 0.58,
    layerIds: marshLayers,
    linkedObjectIds: ['npc-goody-ashby', 'npc-dunmore-fenn'],
    selectedByDefault: false,
  },
  {
    id: 'pin-mf-lamp-house',
    mapId: MAP_MARSH_ID,
    locationId: 'location-wardens-lamp-house',
    label: 'Lamp House',
    order: 5,
    x: 0.72,
    y: 0.32,
    layerIds: [...marshLayers, 'mf-marsh-notes'],
    linkedObjectIds: [
      'npc-tamsin-reed',
      'encounter-warden-lamp-patrol',
      'handout-wardens-tithe-tally',
    ],
    selectedByDefault: false,
  },
  {
    id: 'pin-mf-eel-market',
    mapId: MAP_MARSH_ID,
    locationId: 'location-eel-market',
    label: 'Eel Market',
    order: 6,
    x: 0.82,
    y: 0.68,
    layerIds: marshLayers,
    linkedObjectIds: ['encounter-drover-standoff', 'npc-dunmore-fenn'],
    selectedByDefault: false,
  },
  {
    id: 'pin-mf-homestead',
    mapId: MAP_HOMESTEAD_ID,
    locationId: 'location-verrow-homestead',
    label: 'Verrow Homestead',
    order: 1,
    x: 0.42,
    y: 0.4,
    layerIds: homesteadLayers,
    linkedObjectIds: [
      'encounter-shifting-rooms',
      'npc-ysolde-verrow',
      'handout-family-portrait-frames',
    ],
    selectedByDefault: true,
  },
  {
    id: 'pin-mf-nursery',
    mapId: MAP_HOMESTEAD_ID,
    locationId: 'location-homestead-nursery',
    label: 'Homestead Nursery',
    order: 2,
    x: 0.28,
    y: 0.26,
    layerIds: [...homesteadLayers, 'mf-homestead-notes'],
    linkedObjectIds: ['npc-pim-verrow', 'handout-counting-rhyme'],
    selectedByDefault: false,
  },
  {
    id: 'pin-mf-well',
    mapId: MAP_HOMESTEAD_ID,
    locationId: 'location-verrow-well',
    label: 'The Verrow Well',
    order: 3,
    x: 0.7,
    y: 0.68,
    layerIds: [
      ...homesteadLayers,
      'mf-homestead-notes',
      'mf-homestead-environment',
    ],
    linkedObjectIds: [
      'npc-the-eighth-voice',
      'encounter-well-whisperer',
      'lore-forgetting-bargain',
    ],
    selectedByDefault: false,
  },
];
