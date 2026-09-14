/**
 * Asset Favorites and Recently Used Manager
 * Tracks user's favorite assets and recently used items
 */

const FAVORITES_KEY = 'nexus_asset_favorites';
const RECENT_KEY = 'nexus_asset_recent';
const MAX_RECENT = 20;

export interface FavoriteAsset {
  id: string;
  type: 'token' | 'map';
  timestamp: number;
}

class AssetFavoritesManager {
  private favorites: Set<string> = new Set();
  private recent: FavoriteAsset[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const favoritesData = localStorage.getItem(FAVORITES_KEY);
      if (favoritesData) {
        this.favorites = new Set(JSON.parse(favoritesData));
      }

      const recentData = localStorage.getItem(RECENT_KEY);
      if (recentData) {
        this.recent = JSON.parse(recentData);
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...this.favorites]));
      localStorage.setItem(RECENT_KEY, JSON.stringify(this.recent));
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  }

  // Favorites
  isFavorite(assetId: string): boolean {
    return this.favorites.has(assetId);
  }

  toggleFavorite(assetId: string): boolean {
    if (this.favorites.has(assetId)) {
      this.favorites.delete(assetId);
    } else {
      this.favorites.add(assetId);
    }
    this.saveToStorage();
    return this.favorites.has(assetId);
  }

  getFavorites(): string[] {
    return [...this.favorites];
  }

  // Recently used
  addToRecent(assetId: string, type: 'token' | 'map') {
    // Remove if already exists
    this.recent = this.recent.filter((item) => item.id !== assetId);

    // Add to beginning
    this.recent.unshift({
      id: assetId,
      type,
      timestamp: Date.now(),
    });

    // Limit size
    if (this.recent.length > MAX_RECENT) {
      this.recent = this.recent.slice(0, MAX_RECENT);
    }

    this.saveToStorage();
  }

  getRecent(type?: 'token' | 'map'): FavoriteAsset[] {
    if (type) {
      return this.recent.filter((item) => item.type === type);
    }
    return this.recent;
  }

  clearRecent() {
    this.recent = [];
    this.saveToStorage();
  }
}

export const assetFavoritesManager = new AssetFavoritesManager();
