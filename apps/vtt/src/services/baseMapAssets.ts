/**
 * Base Map Asset Manager
 * Handles loading and organizing bundled base map assets
 */

export interface BaseMap {
  id: string;
  name: string;
  path: string;
  gridSize?: {
    width: number;
    height: number;
  };
  tags: string[];
  format: string;
  isDefault: boolean;
  isGenerated?: boolean;
  category?: string;
  thumbnail?: string;
}

export interface BaseMapCategory {
  name: string;
  maps: BaseMap[];
}

class BaseMapAssetManager {
  private maps: BaseMap[] = [];
  private isInitialized = false;
  private imageCache = new Map<string, HTMLImageElement>();

  /**
   * Initialize by loading the default manifest
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const response = await fetch('/assets/defaults/manifest.json');
      if (!response.ok) {
        console.warn('Default manifest not found for base maps');
        return;
      }

      const manifest = await response.json();
      this.maps = manifest.maps.items || [];
      this.isInitialized = true;

      console.log(
        `Initialized BaseMapAssetManager with ${this.maps.length} maps`,
      );
    } catch (error) {
      console.error('Failed to initialize BaseMapAssetManager:', error);
    }
  }

  /**
   * Get all available base maps
   */
  getAllMaps(): BaseMap[] {
    return [...this.maps];
  }

  /**
   * Search maps by query
   */
  searchMaps(query: string): BaseMap[] {
    if (!query.trim()) return this.getAllMaps();

    const lowerQuery = query.toLowerCase();
    return this.maps.filter(
      (map) =>
        map.name.toLowerCase().includes(lowerQuery) ||
        map.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)),
    );
  }

  /**
   * Get maps organized by category (based on tags)
   */
  getMapsByCategory(): BaseMapCategory[] {
    const categories = new Map<string, BaseMap[]>();

    for (const map of this.maps) {
      // Use primary tag as category
      const category = map.tags[0] || 'other';

      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(map);
    }

    return Array.from(categories.entries()).map(([name, maps]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      maps,
    }));
  }

  /**
   * Get map by ID
   */
  getMapById(id: string): BaseMap | null {
    return this.maps.find((map) => map.id === id) || null;
  }

  /**
   * Preload a map image
   */
  async preloadMap(path: string): Promise<HTMLImageElement> {
    // Check cache
    if (this.imageCache.has(path)) {
      return this.imageCache.get(path)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.imageCache.set(path, img);
        resolve(img);
      };

      img.onerror = () => {
        reject(new Error(`Failed to load map: ${path}`));
      };

      img.src = path;
    });
  }

  /**
   * Clear image cache
   */
  clearCache(): void {
    this.imageCache.clear();
    console.log('Base map cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { cachedImages: number; totalMaps: number } {
    return {
      cachedImages: this.imageCache.size,
      totalMaps: this.maps.length,
    };
  }
}

// Export singleton instance
export const baseMapAssetManager = new BaseMapAssetManager();
