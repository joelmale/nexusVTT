import fs from 'fs';
import path from 'path';
import { parseAssetManifest, type AssetManifest } from '../../shared/types.js';

function createEmptyManifest(): AssetManifest {
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalAssets: 0,
    categories: [],
    assets: [],
  };
}

/**
 * Loads and holds the bundled asset manifest, re-reading it on change outside
 * production. Failures degrade to an empty manifest rather than throwing.
 */
export class AssetManifestStore {
  private manifest: AssetManifest | null = null;

  constructor(private readonly assetsPath: string) {}

  /** The most recently loaded manifest, or null before the first load. */
  public get current(): AssetManifest | null {
    return this.manifest;
  }

  public load(): void {
    try {
      const manifestPath = path.join(this.assetsPath, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        this.manifest = parseAssetManifest(
          JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown,
        );
        console.log(
          `📋 Loaded manifest: ${this.manifest?.totalAssets} assets in ${this.manifest?.categories.length} categories`,
        );
      } else {
        console.warn('⚠️  No manifest.json found at', manifestPath);
        this.manifest = createEmptyManifest();
      }
    } catch (error) {
      console.error('❌ Failed to load manifest:', error);
      this.manifest = createEmptyManifest();
    }

    if (process.env.NODE_ENV !== 'production') {
      const manifestPath = path.join(this.assetsPath, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        fs.watchFile(manifestPath, () => {
          console.log('📋 Manifest changed, reloading...');
          this.load();
        });
      }
    }
  }
}
