import React from 'react';
import type { Prop, PropLibrary, PropCategory } from '@/types/prop';

interface BaseProp {
  name: string;
  category: PropCategory;
  size: 'tiny' | 'small' | 'medium' | 'large';
  tags: string[];
  stats?: {
    lightRadius?: number;
    locked?: boolean;
  };
  interactive?: boolean;
}

/**
 * Prop Asset Manager handles loading, caching, and organizing prop assets
 */
class PropAssetManager {
  private imageCache = new Map<string, HTMLImageElement>();
  private loadingPromises = new Map<string, Promise<HTMLImageElement>>();
  private propLibraries: PropLibrary[] = [];
  private isInitialized = false;

  /**
   * Initialize with default prop libraries
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load default prop libraries
      this.propLibraries = await this.loadDefaultLibraries();
      this.isInitialized = true;
      console.log(
        `Initialized PropAssetManager with ${this.propLibraries.length} libraries`,
      );
    } catch (error) {
      console.error('Failed to initialize PropAssetManager:', error);
    }
  }

  /**
   * Load default prop libraries
   */
  private async loadDefaultLibraries(): Promise<PropLibrary[]> {
    try {
      // TODO: Load from manifest when available
      return this.createFallbackLibraries();
    } catch (error) {
      console.error('Failed to load default manifest, using fallback:', error);
      return this.createFallbackLibraries();
    }
  }

  /**
   * Create fallback libraries
   */
  private createFallbackLibraries(): PropLibrary[] {
    return [
      {
        id: 'default-furniture',
        name: 'Furniture & Objects',
        description: 'Tables, chairs, doors, and common objects',
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        props: this.createDefaultFurnitureProps(),
      },
      {
        id: 'default-treasure',
        name: 'Treasure & Items',
        description: 'Chests, coins, gems, and magical items',
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        props: this.createDefaultTreasureProps(),
      },
      {
        id: 'default-decoration',
        name: 'Decorations',
        description: 'Decorative objects and environment details',
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        props: this.createDefaultDecorationProps(),
      },
      {
        id: 'default-traps',
        name: 'Traps & Hazards',
        description: 'Dangerous obstacles and hidden traps',
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        props: this.createDefaultTrapProps(),
      },
      {
        id: 'default-effects',
        name: 'Effects & Markers',
        description: 'Visual effects and battlefield markers',
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        props: this.createDefaultEffectProps(),
      },
    ];
  }

  /**
   * Create default furniture props
   */
  private createDefaultFurnitureProps(): Prop[] {
    const baseProps = [
      {
        name: 'Wooden Table',
        category: 'furniture' as PropCategory,
        size: 'medium' as const,
        tags: ['furniture', 'table', 'wood'],
      },
      {
        name: 'Chair',
        category: 'furniture' as PropCategory,
        size: 'small' as const,
        tags: ['furniture', 'chair', 'seating'],
      },
      {
        name: 'Wooden Door',
        category: 'door' as PropCategory,
        size: 'small' as const,
        tags: ['door', 'entrance', 'wood'],
      },
      {
        name: 'Iron Door',
        category: 'door' as PropCategory,
        size: 'small' as const,
        tags: ['door', 'metal', 'secure'],
      },
      {
        name: 'Bookshelf',
        category: 'furniture' as PropCategory,
        size: 'medium' as const,
        tags: ['furniture', 'books', 'storage'],
      },
      {
        name: 'Barrel',
        category: 'container' as PropCategory,
        size: 'small' as const,
        tags: ['container', 'barrel', 'storage'],
        interactive: true,
      },
      {
        name: 'Crate',
        category: 'container' as PropCategory,
        size: 'small' as const,
        tags: ['container', 'crate', 'storage'],
        interactive: true,
      },
      {
        name: 'Sack',
        category: 'container' as PropCategory,
        size: 'tiny' as const,
        tags: ['container', 'sack', 'storage'],
        interactive: true,
      },
      {
        name: 'Wardrobe',
        category: 'container' as PropCategory,
        size: 'large' as const,
        tags: ['container', 'wardrobe', 'storage'],
        interactive: true,
      },
      {
        name: 'Torch',
        category: 'light' as PropCategory,
        size: 'tiny' as const,
        tags: ['light', 'fire', 'torch'],
        stats: { lightRadius: 20 },
      },
      {
        name: 'Chandelier',
        category: 'light' as PropCategory,
        size: 'medium' as const,
        tags: ['light', 'chandelier', 'hanging'],
        stats: { lightRadius: 30 },
      },
      {
        name: 'Statue',
        category: 'decoration' as PropCategory,
        size: 'medium' as const,
        tags: ['decoration', 'statue', 'art'],
      },
    ];

    return baseProps.map((prop: BaseProp) => ({
      id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: prop.name,
      image: this.generatePlaceholderPropImage(prop.name),
      size: prop.size,
      category: prop.category,
      tags: prop.tags,
      stats: prop.stats,
      interactive: prop.interactive,
      isCustom: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  }

  /**
   * Create default treasure props
   */
  private createDefaultTreasureProps(): Prop[] {
    const baseProps = [
      {
        name: 'Treasure Chest',
        category: 'treasure' as PropCategory,
        size: 'small' as const,
        tags: ['treasure', 'chest', 'container'],
        stats: { locked: true },
        interactive: true,
      },
      {
        name: 'Gold Pile',
        category: 'treasure' as PropCategory,
        size: 'tiny' as const,
        tags: ['treasure', 'gold', 'coins'],
      },
      {
        name: 'Gem',
        category: 'treasure' as PropCategory,
        size: 'tiny' as const,
        tags: ['treasure', 'gem', 'jewel'],
      },
      {
        name: 'Magic Sword',
        category: 'treasure' as PropCategory,
        size: 'small' as const,
        tags: ['treasure', 'weapon', 'magic'],
      },
      {
        name: 'Scroll',
        category: 'treasure' as PropCategory,
        size: 'tiny' as const,
        tags: ['treasure', 'scroll', 'magic'],
      },
      {
        name: 'Potion',
        category: 'treasure' as PropCategory,
        size: 'tiny' as const,
        tags: ['treasure', 'potion', 'consumable'],
      },
    ];

    return baseProps.map((prop: BaseProp) => ({
      id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: prop.name,
      image: this.generatePlaceholderPropImage(prop.name),
      size: prop.size,
      category: prop.category,
      tags: prop.tags,
      stats: prop.stats,
      interactive: prop.interactive,
      isCustom: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  }

  /**
   * Create default decoration props
   */
  private createDefaultDecorationProps(): Prop[] {
    const baseProps = [
      {
        name: 'Tapestry',
        category: 'decoration' as PropCategory,
        size: 'medium' as const,
        tags: ['decoration', 'tapestry', 'wall'],
      },
      {
        name: 'Painting',
        category: 'decoration' as PropCategory,
        size: 'small' as const,
        tags: ['decoration', 'art', 'wall'],
      },
      {
        name: 'Rug',
        category: 'decoration' as PropCategory,
        size: 'large' as const,
        tags: ['decoration', 'rug', 'floor'],
      },
      {
        name: 'Banner',
        category: 'decoration' as PropCategory,
        size: 'medium' as const,
        tags: ['decoration', 'banner', 'hanging'],
      },
      {
        name: 'Fountain',
        category: 'decoration' as PropCategory,
        size: 'large' as const,
        tags: ['decoration', 'fountain', 'water'],
      },
      {
        name: 'Pillar',
        category: 'decoration' as PropCategory,
        size: 'medium' as const,
        tags: ['decoration', 'pillar', 'column'],
      },
      {
        name: 'Plant',
        category: 'decoration' as PropCategory,
        size: 'small' as const,
        tags: ['decoration', 'plant', 'nature'],
      },
    ];

    return baseProps.map((prop) => ({
      id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: prop.name,
      image: this.generatePlaceholderPropImage(prop.name),
      size: prop.size,
      category: prop.category,
      tags: prop.tags,
      isCustom: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  }

  /**
   * Create default trap props
   */
  private createDefaultTrapProps(): Prop[] {
    const baseProps = [
      {
        name: 'Spike Trap',
        category: 'trap' as PropCategory,
        size: 'small' as const,
        tags: ['trap', 'spikes', 'danger'],
      },
      {
        name: 'Pit Trap',
        category: 'trap' as PropCategory,
        size: 'medium' as const,
        tags: ['trap', 'pit', 'fall'],
      },
      {
        name: 'Arrow Trap',
        category: 'trap' as PropCategory,
        size: 'small' as const,
        tags: ['trap', 'arrow', 'projectile'],
      },
      {
        name: 'Pressure Plate',
        category: 'trap' as PropCategory,
        size: 'small' as const,
        tags: ['trap', 'trigger', 'floor'],
      },
      {
        name: 'Bear Trap',
        category: 'trap' as PropCategory,
        size: 'small' as const,
        tags: ['trap', 'bear', 'clamp'],
      },
    ];

    return baseProps.map((prop) => ({
      id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: prop.name,
      image: this.generatePlaceholderPropImage(prop.name),
      size: prop.size,
      category: prop.category,
      tags: prop.tags,
      isCustom: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  }

  /**
   * Create default effect props
   */
  private createDefaultEffectProps(): Prop[] {
    const baseProps = [
      {
        name: 'Fire',
        category: 'effect' as PropCategory,
        size: 'small' as const,
        tags: ['effect', 'fire', 'hazard'],
        stats: { lightRadius: 15 },
      },
      {
        name: 'Smoke',
        category: 'effect' as PropCategory,
        size: 'medium' as const,
        tags: ['effect', 'smoke', 'obscure'],
      },
      {
        name: 'Magic Circle',
        category: 'effect' as PropCategory,
        size: 'large' as const,
        tags: ['effect', 'magic', 'circle'],
      },
      {
        name: 'Blood Pool',
        category: 'effect' as PropCategory,
        size: 'medium' as const,
        tags: ['effect', 'blood', 'gore'],
      },
      {
        name: 'Ice Patch',
        category: 'effect' as PropCategory,
        size: 'medium' as const,
        tags: ['effect', 'ice', 'terrain'],
      },
      {
        name: 'Web',
        category: 'effect' as PropCategory,
        size: 'large' as const,
        tags: ['effect', 'web', 'trap'],
      },
    ];

    return baseProps.map((prop: BaseProp) => ({
      id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: prop.name,
      image: this.generatePlaceholderPropImage(prop.name),
      size: prop.size,
      category: prop.category,
      tags: prop.tags,
      stats: prop.stats,
      interactive: prop.interactive,
      isCustom: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  }

  /**
   * Generate a placeholder image for a prop
   */
  private getPlaceholderInitials(label: string): string {
    const trimmed = label.trim();
    if (!trimmed) return 'P';
    const words = trimmed.split(/\s+/);
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  private pickPlaceholderColor(label: string, color?: string): string {
    if (color) return color;
    const colors = [
      '#8b7355', // brown
      '#a0522d', // sienna
      '#d2691e', // chocolate
      '#cd853f', // peru
      '#daa520', // goldenrod
      '#b8860b', // darkgoldenrod
      '#4A9EFF', // blue
      '#2ECC71', // green
      '#E67E22', // orange
      '#9B59B6', // purple
    ];
    return colors[label.length % colors.length];
  }

  private generatePlaceholderPropImage(label: string, color?: string): string {
    const initials = this.getPlaceholderInitials(label);
    const chosenColor = this.pickPlaceholderColor(label, color);

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <rect width="100" height="100" fill="${chosenColor}"/>
        <text x="50" y="50" font-size="48" font-weight="bold"
              text-anchor="middle" dominant-baseline="central" fill="white">
          ${initials}
        </text>
      </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  generatePlaceholderImage(label: string, color?: string): string {
    return this.generatePlaceholderPropImage(label, color);
  }

  /**
   * Get all props from all libraries
   */
  getAllProps(): Prop[] {
    const merged = new Map<string, Prop>();
    const defaultLibraries = this.propLibraries.filter((lib) => lib.isDefault);
    const customLibraries = this.propLibraries.filter((lib) => !lib.isDefault);

    defaultLibraries.forEach((library) => {
      library.props.forEach((prop) => merged.set(prop.id, prop));
    });
    customLibraries.forEach((library) => {
      library.props.forEach((prop) => merged.set(prop.id, prop));
    });

    return Array.from(merged.values());
  }

  /**
   * Get prop by ID
   */
  getPropById(id: string): Prop | null {
    const customLibraries = this.propLibraries.filter((lib) => !lib.isDefault);
    const defaultLibraries = this.propLibraries.filter((lib) => lib.isDefault);
    for (const library of [...customLibraries, ...defaultLibraries]) {
      const prop = library.props.find((p) => p.id === id);
      if (prop) return prop;
    }
    return null;
  }

  /**
   * Search props by query
   */
  searchProps(query: string): Prop[] {
    if (!query.trim()) return this.getAllProps();

    const lowerQuery = query.toLowerCase();
    return this.getAllProps().filter(
      (prop) =>
        prop.name.toLowerCase().includes(lowerQuery) ||
        prop.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)),
    );
  }

  /**
   * Get props by category
   */
  getPropsByCategory(category: PropCategory): Prop[] {
    return this.getAllProps().filter((prop) => prop.category === category);
  }

  /**
   * Add a custom prop
   */
  async addCustomProp(
    prop: Omit<Prop, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Prop> {
    const newProp: Prop = {
      ...prop,
      image:
        prop.image && prop.image.trim().length > 0
          ? prop.image
          : this.generatePlaceholderPropImage(prop.name),
      id: `custom-prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isCustom: true,
    };

    // Find or create custom library
    let customLibrary = this.propLibraries.find(
      (lib) => lib.id === 'custom-props',
    );
    if (!customLibrary) {
      customLibrary = {
        id: 'custom-props',
        name: 'Custom Props',
        description: 'User-created props',
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        props: [],
      };
      this.propLibraries.push(customLibrary);
    }

    customLibrary.props.push(newProp);
    await this.saveLibrariesToStorage();

    console.log('Added custom prop:', newProp.name);
    return newProp;
  }

  /**
   * Update a prop
   */
  async updateProp(id: string, updates: Partial<Prop>): Promise<void> {
    for (const library of this.propLibraries) {
      const propIndex = library.props.findIndex((p) => p.id === id);
      if (propIndex !== -1) {
        library.props[propIndex] = {
          ...library.props[propIndex],
          ...updates,
          updatedAt: Date.now(),
        };
        await this.saveLibrariesToStorage();
        console.log('Updated prop:', id);
        return;
      }
    }
    throw new Error(`Prop not found: ${id}`);
  }

  /**
   * Update a prop, creating a custom override when modifying default libraries.
   */
  async updatePropWithOverride(id: string, updates: Partial<Prop>): Promise<void> {
    const customLibraries = this.propLibraries.filter((lib) => !lib.isDefault);
    for (const library of customLibraries) {
      const propIndex = library.props.findIndex((p) => p.id === id);
      if (propIndex !== -1) {
        library.props[propIndex] = {
          ...library.props[propIndex],
          ...updates,
          updatedAt: Date.now(),
        };
        await this.saveLibrariesToStorage();
        console.log('Updated custom prop:', id);
        return;
      }
    }

    const defaultProp = this.getPropById(id);
    if (!defaultProp) {
      throw new Error(`Prop not found: ${id}`);
    }

    const override: Prop = {
      ...defaultProp,
      ...updates,
      isCustom: true,
      updatedAt: Date.now(),
    };

    let customLibrary = this.propLibraries.find(
      (lib) => lib.id === 'custom-props',
    );
    if (!customLibrary) {
      customLibrary = {
        id: 'custom-props',
        name: 'Custom Props',
        description: 'User-created props',
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        props: [],
      };
      this.propLibraries.push(customLibrary);
    }

    const existingIndex = customLibrary.props.findIndex((p) => p.id === id);
    if (existingIndex !== -1) {
      customLibrary.props[existingIndex] = override;
    } else {
      customLibrary.props.push(override);
    }

    await this.saveLibrariesToStorage();
    console.log('Created custom override for prop:', id);
  }

  /**
   * Delete a prop
   */
  async deleteProp(id: string): Promise<void> {
    for (const library of this.propLibraries) {
      const propIndex = library.props.findIndex((p) => p.id === id);
      if (propIndex !== -1) {
        library.props.splice(propIndex, 1);
        await this.saveLibrariesToStorage();
        console.log('Deleted prop:', id);
        return;
      }
    }
    throw new Error(`Prop not found: ${id}`);
  }

  /**
   * Save libraries to localStorage
   */
  private async saveLibrariesToStorage(): Promise<void> {
    try {
      // Only save custom libraries
      const customLibraries = this.propLibraries.filter(
        (lib) => !lib.isDefault,
      );
      localStorage.setItem(
        'nexus_prop_libraries',
        JSON.stringify(customLibraries),
      );
    } catch (error) {
      console.error('Failed to save prop libraries:', error);
    }
  }

  /**
   * Load libraries from localStorage
   */
  private async loadLibrariesFromStorage(): Promise<PropLibrary[]> {
    try {
      const stored = localStorage.getItem('nexus_prop_libraries');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load prop libraries from storage:', error);
    }
    return [];
  }

  /**
   * Refresh custom prop libraries from localStorage
   */
  async refreshCustomLibraries(): Promise<void> {
    const customLibraries = await this.loadLibrariesFromStorage();
    this.propLibraries = [
      ...this.propLibraries.filter((lib) => lib.isDefault),
      ...customLibraries,
    ];
  }

  /**
   * Preload a prop image
   */
  async preloadImage(url: string): Promise<HTMLImageElement> {
    // Check cache
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }

    // Check if already loading
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    // Start loading
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(url, img);
        this.loadingPromises.delete(url);
        resolve(img);
      };
      img.onerror = () => {
        this.loadingPromises.delete(url);
        reject(new Error(`Failed to load image: ${url}`));
      };
      img.src = url;
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }
}

// Export singleton instance
export const propAssetManager = new PropAssetManager();

// React hook for using prop assets
export function usePropAssets() {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    let isMounted = true;
    const init = async () => {
      await propAssetManager.initialize();
      await propAssetManager.refreshCustomLibraries();
      if (isMounted) {
        forceUpdate();
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  return {
    getAllProps: () => propAssetManager.getAllProps(),
    getPropById: (id: string) => propAssetManager.getPropById(id),
    searchProps: (query: string) => propAssetManager.searchProps(query),
    getPropsByCategory: (category: PropCategory) =>
      propAssetManager.getPropsByCategory(category),
    addCustomProp: async (
      prop: Omit<Prop, 'id' | 'createdAt' | 'updatedAt'>,
    ) => {
      const result = await propAssetManager.addCustomProp(prop);
      forceUpdate();
      return result;
    },
    updateProp: async (id: string, updates: Partial<Prop>) => {
      await propAssetManager.updatePropWithOverride(id, updates);
      forceUpdate();
    },
    deleteProp: async (id: string) => {
      await propAssetManager.deleteProp(id);
      forceUpdate();
    },
    generatePlaceholderImage: (label: string, color?: string) =>
      propAssetManager.generatePlaceholderImage(label, color),
  };
}
