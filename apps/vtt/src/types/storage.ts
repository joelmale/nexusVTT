export interface DungeonMapDB {
  id: string;
  name: string;
  imageData: string;
  format: 'webp' | 'png';
  originalSize: number;
  compressedSize: number;
  timestamp: number;
  source: 'one-page-dungeon-generator';
}

export interface GameStateDB {
  id: string;
  scenes: unknown[];
  activeSceneId: string | null;
  characters: unknown[];
  initiative: unknown;
  settings: unknown;
  timestamp: number;
  version: number;
}

export interface StorageStats {
  count: number;
  totalSize: number;
  averageSize: number;
}
