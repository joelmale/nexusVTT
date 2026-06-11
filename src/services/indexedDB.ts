/**
 * IndexedDB wrapper for dungeon maps and game state
 * Provides unlimited local storage for DM-generated dungeon maps and game state
 */

export interface DungeonMapDB {
  id: string;
  name: string;
  imageData: string; // base64 data URL
  format: 'webp' | 'png'; // image format
  originalSize: number; // original blob size in bytes
  compressedSize: number; // base64 size in bytes
  timestamp: number;
  source: 'one-page-dungeon-generator';
}

export interface GameStateDB {
  id: string; // 'current' or campaignId
  scenes: unknown[];
  activeSceneId: string | null;
  characters: unknown[];
  initiative: unknown;
  settings: unknown;
  timestamp: number;
  version: number; // For conflict resolution
}

export interface StorageStats {
  count: number;
  totalSize: number; // bytes
  averageSize: number; // bytes
}

class DungeonMapIndexedDB {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'NexusVTT';
  private readonly DB_VERSION = 5; // v5: Added tempStorage for generator
  private readonly MAPS_STORE = 'maps';
  private readonly GAMESTATE_STORE = 'gameState';
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    // Check if we need to delete corrupted database (if it's missing required stores)
    try {
      const checkRequest = indexedDB.open(this.DB_NAME);
      await new Promise<void>((resolve) => {
        checkRequest.onsuccess = () => {
          const db = checkRequest.result;
          const storeNames = Array.from(db.objectStoreNames);
          console.log(`🔍 Checking existing database: ${storeNames.length} stores found - ${storeNames.join(', ')}`);

          // Check if required stores exist
          const hasMapsStore = db.objectStoreNames.contains(this.MAPS_STORE);
          const hasGameStateStore = db.objectStoreNames.contains(this.GAMESTATE_STORE);

          // If database is missing required stores, it's corrupted - need to delete and recreate
          if (!hasMapsStore || !hasGameStateStore) {
            console.warn(`⚠️ Database exists at v${db.version} but missing required stores:`);
            console.warn(`   maps: ${hasMapsStore}, gameState: ${hasGameStateStore}`);
            console.warn(`   Will delete and recreate database`);
            db.close();

            // Delete the corrupted database synchronously
            const deleteRequest = indexedDB.deleteDatabase(this.DB_NAME);
            deleteRequest.onsuccess = () => {
              console.log(`🗑️ Deleted corrupted ${this.DB_NAME} database`);
              resolve();
            };
            deleteRequest.onerror = () => {
              console.warn(`⚠️ Could not delete corrupted database`);
              resolve();
            };
            deleteRequest.onblocked = () => {
              console.warn(`⚠️ ${this.DB_NAME} deletion blocked - close all tabs and refresh`);
              resolve();
            };
          } else {
            console.log(`✅ Database has all required stores`);
            db.close();
            resolve();
          }
        };
        checkRequest.onerror = () => resolve(); // Database doesn't exist yet
      });
    } catch (error) {
      console.warn('Could not check existing database:', error);
    }

    // Migrate data from old database before deleting it
    try {
      const oldDbRequest = indexedDB.open('NexusDungeonMaps');
      await new Promise<void>((resolve) => {
        oldDbRequest.onsuccess = async () => {
          const oldDb = oldDbRequest.result;
          if (oldDb.objectStoreNames.contains('maps')) {
            console.log('🔄 Migrating maps from old NexusDungeonMaps database...');
            try {
              const transaction = oldDb.transaction(['maps'], 'readonly');
              const store = transaction.objectStore('maps');
              const getAllRequest = store.getAll();

              await new Promise<void>((migrateResolve) => {
                getAllRequest.onsuccess = () => {
                  const oldMaps = getAllRequest.result;
                  console.log(`Found ${oldMaps.length} maps in old database`);
                  // Store in localStorage temporarily for migration by dungeonMapService
                  if (oldMaps.length > 0) {
                    localStorage.setItem('nexus_old_indexeddb_maps', JSON.stringify(oldMaps));
                    console.log('💾 Stored old maps in localStorage for migration');
                  }
                  migrateResolve();
                };
                getAllRequest.onerror = () => {
                  console.warn('Could not read old maps:', getAllRequest.error);
                  migrateResolve();
                };
              });
            } catch (error) {
              console.warn('Migration from old database failed:', error);
            }
          }
          oldDb.close();
          resolve();
        };
        oldDbRequest.onerror = () => resolve(); // Old database doesn't exist
      });
    } catch (error) {
      console.warn('Could not access old database for migration:', error);
    }

    // Delete old database with old name if it exists
    try {
      await new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase('NexusDungeonMaps');
        deleteRequest.onsuccess = () => {
          console.log('🗑️ Deleted old NexusDungeonMaps database');
          resolve();
        };
        deleteRequest.onerror = () => resolve(); // Ignore errors
        deleteRequest.onblocked = () => {
          console.warn('⚠️ NexusDungeonMaps deletion blocked - close all tabs');
          resolve();
        };
      });
    } catch (error) {
      console.warn('Could not delete old database:', error);
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        const storeNames = Array.from(this.db.objectStoreNames);
        console.log(`✅ DungeonMapIndexedDB initialized v${this.db.version} with stores: ${storeNames.join(', ')}`);

        // Verify expected stores exist
        if (!this.db.objectStoreNames.contains(this.MAPS_STORE)) {
          console.error(`❌ Missing required store: ${this.MAPS_STORE}`);
        }
        if (!this.db.objectStoreNames.contains(this.GAMESTATE_STORE)) {
          console.error(`❌ Missing required store: ${this.GAMESTATE_STORE}`);
        }

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        console.log(`🔧 IndexedDB upgrade: v${oldVersion} → v${this.DB_VERSION}`);

        // Create maps store if it doesn't exist
        if (!db.objectStoreNames.contains(this.MAPS_STORE)) {
          const mapsStore = db.createObjectStore(this.MAPS_STORE, { keyPath: 'id' });
          mapsStore.createIndex('timestamp', 'timestamp', { unique: false });
          mapsStore.createIndex('name', 'name', { unique: false });
          console.log('✅ Created IndexedDB store for dungeon maps');
        }

        // Create game state store if it doesn't exist
        if (!db.objectStoreNames.contains(this.GAMESTATE_STORE)) {
          const gameStateStore = db.createObjectStore(this.GAMESTATE_STORE, { keyPath: 'id' });
          gameStateStore.createIndex('timestamp', 'timestamp', { unique: false });
          gameStateStore.createIndex('version', 'version', { unique: false });
          console.log('✅ Created IndexedDB store for game state');
        }

        // Create tempStorage store if it doesn't exist (v5+)
        if (!db.objectStoreNames.contains('tempStorage')) {
          db.createObjectStore('tempStorage');
          console.log('✅ Created IndexedDB store for temporary storage');
        }

        console.log(`✅ IndexedDB upgrade complete. Available stores: ${Array.from(db.objectStoreNames).join(', ')}`);
      };
    });

    return this.initPromise;
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInit(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
  }

  /**
   * Save a dungeon map to IndexedDB
   */
  async saveMap(mapData: Omit<DungeonMapDB, 'id'>): Promise<string> {
    await this.ensureInit();

    const mapId = `dungeon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const map: DungeonMapDB = {
      ...mapData,
      id: mapId,
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.MAPS_STORE], 'readwrite');
      const store = transaction.objectStore(this.MAPS_STORE);
      const request = store.add(map);

      request.onsuccess = () => {
        console.log(
          `✅ Saved dungeon map: ${mapId} (${map.format.toUpperCase()}, ${(map.originalSize / 1024).toFixed(1)} KB original)`,
        );
        resolve(mapId);
      };

      request.onerror = () => {
        console.error('Failed to save dungeon map:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all dungeon maps
   */
  async getAllMaps(): Promise<DungeonMapDB[]> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.MAPS_STORE], 'readonly');
      const store = transaction.objectStore(this.MAPS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const maps = request.result as DungeonMapDB[];
        // Sort by timestamp (newest first)
        maps.sort((a, b) => b.timestamp - a.timestamp);
        resolve(maps);
      };

      request.onerror = () => {
        console.error('Failed to get dungeon maps:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get a specific dungeon map by ID
   */
  async getMapById(id: string): Promise<DungeonMapDB | null> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.MAPS_STORE], 'readonly');
      const store = transaction.objectStore(this.MAPS_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('Failed to get dungeon map:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete a dungeon map
   */
  async deleteMap(id: string): Promise<boolean> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.MAPS_STORE], 'readwrite');
      const store = transaction.objectStore(this.MAPS_STORE);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`🗑️ Deleted dungeon map: ${id}`);
        resolve(true);
      };

      request.onerror = () => {
        console.error('Failed to delete dungeon map:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all dungeon maps
   */
  async clearAll(): Promise<void> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.MAPS_STORE], 'readwrite');
      const store = transaction.objectStore(this.MAPS_STORE);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('🧹 Cleared all dungeon maps from IndexedDB');
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to clear dungeon maps:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    const maps = await this.getAllMaps();
    const totalSize = maps.reduce((sum, map) => sum + map.compressedSize, 0);
    const averageSize = maps.length > 0 ? totalSize / maps.length : 0;

    return {
      count: maps.length,
      totalSize,
      averageSize,
    };
  }

  /**
   * Clean up old maps, keeping only the most recent ones
   */
  async cleanupOldMaps(keepCount: number = 10): Promise<number> {
    const maps = await this.getAllMaps();

    if (maps.length <= keepCount) {
      return 0; // No cleanup needed
    }

    // Keep the most recent maps
    const mapsToDelete = maps.slice(keepCount);
    const deletePromises = mapsToDelete.map((map) => this.deleteMap(map.id));

    await Promise.all(deletePromises);

    console.log(`🧹 Cleaned up ${mapsToDelete.length} old dungeon maps`);
    return mapsToDelete.length;
  }

  // ============================================================================
  // GAME STATE OPERATIONS
  // ============================================================================

  /**
   * Save game state to IndexedDB
   * @param gameState Game state object
   * @param id Storage key (use 'current' for current session, or campaignId)
   */
  async saveGameState(gameState: Omit<GameStateDB, 'timestamp' | 'version'> & { id: string }): Promise<void> {
    await this.ensureInit();

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Check if the store exists
    if (!this.db.objectStoreNames.contains(this.GAMESTATE_STORE)) {
      console.error(`❌ Store '${this.GAMESTATE_STORE}' not found. Available stores:`, Array.from(this.db.objectStoreNames));
      throw new Error(`Store '${this.GAMESTATE_STORE}' not found in database`);
    }

    // Get current version if exists, increment it
    let version = 1;
    try {
      const existing = await this.getGameState(gameState.id);
      version = existing ? existing.version + 1 : 1;
    } catch (error) {
      // If can't get existing, just use version 1
      console.warn('Could not get existing game state version:', error);
    }

    const stateToSave: GameStateDB = {
      ...gameState,
      timestamp: Date.now(),
      version,
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.GAMESTATE_STORE], 'readwrite');
      const store = transaction.objectStore(this.GAMESTATE_STORE);
      const request = store.put(stateToSave);

      request.onsuccess = () => {
        console.log(
          `💾 Saved game state to IndexedDB: ${gameState.id} (v${version}, ${gameState.scenes.length} scenes)`,
        );
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to save game state:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get game state from IndexedDB
   * @param id Storage key (use 'current' for current session, or campaignId)
   */
  async getGameState(id: string): Promise<GameStateDB | null> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // Check if the store exists
      if (!this.db.objectStoreNames.contains(this.GAMESTATE_STORE)) {
        console.error(`❌ Store '${this.GAMESTATE_STORE}' not found. Available stores:`, Array.from(this.db.objectStoreNames));
        reject(new Error(`Store '${this.GAMESTATE_STORE}' not found in database`));
        return;
      }

      const transaction = this.db.transaction([this.GAMESTATE_STORE], 'readonly');
      const store = transaction.objectStore(this.GAMESTATE_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as GameStateDB | undefined;
        if (result) {
          console.log(
            `📂 Loaded game state from IndexedDB: ${id} (v${result.version}, ${result.scenes.length} scenes)`,
          );
        }
        resolve(result || null);
      };

      request.onerror = () => {
        console.error('Failed to get game state:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete game state from IndexedDB
   */
  async deleteGameState(id: string): Promise<void> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.GAMESTATE_STORE], 'readwrite');
      const store = transaction.objectStore(this.GAMESTATE_STORE);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`🗑️ Deleted game state from IndexedDB: ${id}`);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to delete game state:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all game states
   */
  async clearAllGameStates(): Promise<void> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.GAMESTATE_STORE], 'readwrite');
      const store = transaction.objectStore(this.GAMESTATE_STORE);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('🧹 Cleared all game states from IndexedDB');
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to clear game states:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Force-delete and recreate the database (for debugging/testing)
   */
  async resetDatabase(): Promise<void> {
    console.log('🔄 Resetting IndexedDB database...');

    // Close existing connection
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    // Reset init promise
    this.initPromise = null;

    // Delete the database
    return new Promise<void>((resolve) => {
      const deleteRequest = indexedDB.deleteDatabase(this.DB_NAME);

      deleteRequest.onsuccess = () => {
        console.log(`✅ Deleted database: ${this.DB_NAME}`);
        resolve();
      };

      deleteRequest.onerror = () => {
        console.error('Failed to delete database:', deleteRequest.error);
        resolve(); // Continue anyway
      };

      deleteRequest.onblocked = () => {
        console.warn('Database deletion blocked, close all tabs and try again');
        resolve();
      };
    });
  }

  /**
   * Check if IndexedDB is available
   */
  static isAvailable(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }
}

// Export singleton instance
// Use worker-based storage if available, otherwise fall back to direct implementation
import { storageWorkerClient } from './storageWorkerClient';

export const dungeonMapIndexedDB =
  typeof window !== 'undefined' && 'Worker' in window
    ? (storageWorkerClient as unknown as DungeonMapIndexedDB)
    : new DungeonMapIndexedDB();
