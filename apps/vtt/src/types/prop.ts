export type PropSize =
  | 'tiny' // 0.5x0.5 grid squares
  | 'small' // 1x1 grid squares
  | 'medium' // 2x2 grid squares
  | 'large' // 3x3 grid squares
  | 'huge' // 4x4 grid squares
  | 'custom'; // User-defined size

export type PropCategory =
  | 'furniture'
  | 'decoration'
  | 'treasure'
  | 'container'
  | 'door'
  | 'trap'
  | 'light'
  | 'effect'
  | 'other';

const PROP_CATEGORIES: readonly PropCategory[] = [
  'furniture',
  'decoration',
  'treasure',
  'container',
  'door',
  'trap',
  'light',
  'effect',
  'other',
];

export function isPropCategory(value: string): value is PropCategory {
  return PROP_CATEGORIES.some((category) => category === value);
}

export type PropLayer = 'background' | 'props' | 'overlay';

export interface Point {
  x: number;
  y: number;
}

export interface ContainerItem {
  id: string;
  name: string;
  quantity: number;
  description?: string;
}

export interface PropStats {
  hp?: number;
  ac?: number;
  locked?: boolean;
  contents?: ContainerItem[]; // IDs of items inside
  lightRadius?: number; // For light sources
  [key: string]: unknown;
}

export interface Prop {
  id: string;
  name: string;
  image: string; // Can be URL, base64, or hash checksum for IndexedDB
  imageChecksum?: string; // SHA-1 hash for IndexedDB lookups
  thumbnailImage?: string;
  thumbnailChecksum?: string;
  size: PropSize;
  category: PropCategory;
  tags?: string[];
  stats?: PropStats;
  description?: string;
  isCustom?: boolean; // User-uploaded vs system props
  isPublic?: boolean; // Public = available to all players, Private = DM only
  createdAt: number;
  updatedAt: number;
  interactive?: boolean;
  lightRadius?: number;
  lightColor?: string;
}

export interface PlacedProp {
  id: string;
  propId: string; // Reference to the base Prop
  name?: string; // Optional name override
  sceneId: string;
  x: number;
  y: number;
  rotation: number; // In degrees
  scale: number; // Multiplier (1.0 = normal size)
  width?: number; // Custom width in pixels (if size is 'custom')
  height?: number; // Custom height in pixels (if size is 'custom')
  layer: PropLayer;

  // Visibility and permissions
  visibleToPlayers: boolean;
  dmNotesOnly: boolean;

  // Game state
  currentStats?: Partial<PropStats>; // Override base prop stats
  revealed?: boolean; // For hidden objects that can be revealed

  // Metadata
  placedBy: string; // User ID who placed the prop
  createdAt: number;
  updatedAt: number;
}

export interface PropLibrary {
  id: string;
  name: string;
  description?: string;
  props: Prop[];
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

// Prop size to grid squares mapping
export const PROP_SIZE_GRID_MAPPING: Record<PropSize, number> = {
  tiny: 0.5,
  small: 1,
  medium: 2,
  large: 3,
  huge: 4,
  custom: 1, // Default, will be overridden by width/height
};

// Helper function to create a placed prop
export function createPlacedProp(
  propId: string,
  sceneId: string,
  position: Point,
  placedBy: string,
): PlacedProp {
  const now = Date.now();
  return {
    id: `placed-prop-${now}-${Math.random().toString(36).substr(2, 9)}`,
    propId,
    sceneId,
    x: position.x,
    y: position.y,
    rotation: 0,
    scale: 1,
    layer: 'props',
    visibleToPlayers: true,
    dmNotesOnly: false,
    placedBy,
    createdAt: now,
    updatedAt: now,
  };
}
