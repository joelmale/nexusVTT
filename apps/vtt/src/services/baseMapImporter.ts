import { v4 as uuidv4 } from 'uuid';

export interface ImporterOptions {
  blob: Blob;
  filename: string;
  width?: number;
  height?: number;
  onProgress?: (progress: number, status: string) => void;
}

export interface ImporterResult {
  sceneId?: string;
  assetId: string;
  sceneUrl: string;
}

export class BaseMapImporter {
  static async importGeneratedMap(options: ImporterOptions): Promise<ImporterResult> {
    const importId = uuidv4();
    options.onProgress?.(10, 'Preparing upload...');

    const formData = new FormData();
    formData.append('file', options.blob, options.filename);
    formData.append('importId', importId);
    if (options.width) formData.append('width', options.width.toString());
    if (options.height) formData.append('height', options.height.toString());

    options.onProgress?.(30, 'Uploading artifact...');

    const response = await fetch('/api/generated-maps', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload generated map: ${errorText}`);
    }

    const data = await response.json();
    options.onProgress?.(100, 'Import complete');

    return {
      assetId: data.assetId,
      sceneUrl: data.sceneUrl,
      // Note: Full scene integration logic (like background task tracking) can be added here
      // For now we return the uploaded details so the client can create the scene if needed.
    };
  }
}
