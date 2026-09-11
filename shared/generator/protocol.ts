/**
 * Protocol definitions for NexusVTT Generator Hub
 */

export type GeneratorExportPayload =
  | {
      kind: 'svg-master';
      blob: Blob;
      mimeType: 'image/svg+xml';
    }
  | {
      kind: 'raster';
      blob: Blob;
      mimeType: 'image/webp' | 'image/png';
      width: number;
      height: number;
    };

export interface GeneratorExportArtifact {
  protocolVersion: string;
  exportId: string;
  importId: string;
  source: 'dungeon';
  generatorVersion: string;
  payload: GeneratorExportPayload;
  byteLength: number;
  grid: {
    columns?: number;
    rows?: number;
    cellSize?: number;
    bakedIntoImage: boolean;
  };
}

export interface StoredGeneratedMap {
  importId: string;
  assetId: string;
  sceneUrl: string;
  thumbnailUrl: string;
  mimeType: 'image/webp';
  width: number;
  height: number;
  byteLength: number;
  contentHash: string;
}

export type GeneratorHostMessage = 
  | { type: 'generator/ready' }
  | { type: 'host/configure'; payload: { protocolVersion: string; [key: string]: unknown } }
  | { type: 'generator/export-request' }
  | { type: 'generator/export-ready'; payload: GeneratorExportArtifact }
  | { type: 'generator/export-error'; payload: { error: string } }
  | { type: 'host/import-result'; payload: StoredGeneratedMap }
  | { type: 'host/import-cancelled' };
