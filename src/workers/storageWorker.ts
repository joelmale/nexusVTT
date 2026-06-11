/**
 * Storage Worker - Handles all IndexedDB operations off the main thread
 *
 * This worker uses Comlink to provide a transparent async API for IndexedDB operations.
 * All storage operations are moved here to prevent main thread blocking.
 */

import { expose } from 'comlink';
import type { DungeonMapDB, GameStateDB, StorageStats } from '../services/indexedDB';

class StorageWorkerAPI {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'NexusVTT';
  private readonly DB_VERSION = 5; // v5: Added tempStorage for generator
  private readonly MAPS_STORE = 'maps';
  private readonly GAMESTATE_STORE = 'gameState';
  private initPromise: Promise<void> | null = null;

  constructor() {
    console.log('[Worker] 💾 Storage worker initialized');
    this.init();
  }

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('[Worker] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log(
          `[Worker] ✅ IndexedDB opened successfully (v${this.db.version})`
        );
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        console.log(
          `[Worker] 🔧 IndexedDB upgrade: v${oldVersion} → v${this.DB_VERSION}`
        );

        // Create maps store if it doesn't exist
        if (!db.objectStoreNames.contains(this.MAPS_STORE)) {
          const mapsStore = db.createObjectStore(this.MAPS_STORE, {
            keyPath: 'id',
          });
          mapsStore.createIndex('timestamp', 'timestamp', { unique: false });
          mapsStore.createIndex('name', 'name', { unique: false });
          console.log('[Worker] ✅ Created maps store');
        }

        // Create game state store if it doesn't exist
        if (!db.objectStoreNames.contains(this.GAMESTATE_STORE)) {
          const gameStateStore = db.createObjectStore(this.GAMESTATE_STORE, {
            keyPath: 'id',
          });
          gameStateStore.createIndex('timestamp', 'timestamp', {
            unique: false,
          });
          gameStateStore.createIndex('version', 'version', { unique: false });
          console.log('[Worker] ✅ Created gameState store');
        }

        // Create tempStorage store if it doesn't exist (v5+)
        if (!db.objectStoreNames.contains('tempStorage')) {
          db.createObjectStore('tempStorage');
          console.log('[Worker] ✅ Created tempStorage store');
        }
      };
    });

    return this.initPromise;
  }

  private async ensureInit(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
  }

  // =============================================================================
  // DUNGEON MAP OPERATIONS
  // =============================================================================

  async saveMap(
    mapData: Omit<DungeonMapDB, 'id'>
  ): Promise<string> {
    await this.ensureInit();

    const mapId = `dungeon_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

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
          `[Worker] ✅ Saved dungeon map: ${mapId} (${(
            map.originalSize / 1024
          ).toFixed(1)} KB)`
        );
        resolve(mapId);
      };

      request.onerror = () => {
        console.error('[Worker] Failed to save dungeon map:', request.error);
        reject(request.error);
      };
    });
  }

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
        console.log(`[Worker] 📂 Loaded ${maps.length} dungeon maps`);
        resolve(maps);
      };

      request.onerror = () => {
        console.error('[Worker] Failed to get dungeon maps:', request.error);
        reject(request.error);
      };
    });
  }

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
        console.error('[Worker] Failed to get dungeon map:', request.error);
        reject(request.error);
      };
    });
  }

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
        console.log(`[Worker] 🗑️ Deleted dungeon map: ${id}`);
        resolve(true);
      };

      request.onerror = () => {
        console.error('[Worker] Failed to delete dungeon map:', request.error);
        reject(request.error);
      };
    });
  }

  async clearAllMaps(): Promise<void> {
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
        console.log('[Worker] 🧹 Cleared all dungeon maps');
        resolve();
      };

      request.onerror = () => {
        console.error('[Worker] Failed to clear dungeon maps:', request.error);
        reject(request.error);
      };
    });
  }

  async getMapStorageStats(): Promise<StorageStats> {
    const maps = await this.getAllMaps();
    const totalSize = maps.reduce((sum, map) => sum + map.compressedSize, 0);
    const averageSize = maps.length > 0 ? totalSize / maps.length : 0;

    return {
      count: maps.length,
      totalSize,
      averageSize,
    };
  }

  async cleanupOldMaps(keepCount: number = 10): Promise<number> {
    const maps = await this.getAllMaps();

    if (maps.length <= keepCount) {
      return 0;
    }

    const mapsToDelete = maps.slice(keepCount);
    const deletePromises = mapsToDelete.map((map) => this.deleteMap(map.id));

    await Promise.all(deletePromises);

    console.log(`[Worker] 🧹 Cleaned up ${mapsToDelete.length} old dungeon maps`);
    return mapsToDelete.length;
  }

  // =============================================================================
  // GAME STATE OPERATIONS
  // =============================================================================

  async saveGameState(
    gameState: Omit<GameStateDB, 'timestamp' | 'version'> & { id: string }
  ): Promise<void> {
    await this.ensureInit();

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Check if the store exists
    if (!this.db.objectStoreNames.contains(this.GAMESTATE_STORE)) {
      throw new Error(`Store '${this.GAMESTATE_STORE}' not found in database`);
    }

    // Get current version if exists, increment it
    let version = 1;
    try {
      const existing = await this.getGameState(gameState.id);
      version = existing ? existing.version + 1 : 1;
    } catch (error) {
      console.warn('[Worker] Could not get existing game state version:', error);
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

      const transaction = this.db.transaction(
        [this.GAMESTATE_STORE],
        'readwrite'
      );
      const store = transaction.objectStore(this.GAMESTATE_STORE);
      const request = store.put(stateToSave);

      request.onsuccess = () => {
        console.log(
          `[Worker] 💾 Saved game state: ${gameState.id} (v${version}, ${gameState.scenes.length} scenes)`
        );
        resolve();
      };

      request.onerror = () => {
        console.error('[Worker] Failed to save game state:', request.error);
        reject(request.error);
      };
    });
  }

  async getGameState(id: string): Promise<GameStateDB | null> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      if (!this.db.objectStoreNames.contains(this.GAMESTATE_STORE)) {
        reject(
          new Error(`Store '${this.GAMESTATE_STORE}' not found in database`)
        );
        return;
      }

      const transaction = this.db.transaction(
        [this.GAMESTATE_STORE],
        'readonly'
      );
      const store = transaction.objectStore(this.GAMESTATE_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as GameStateDB | undefined;
        if (result) {
          console.log(
            `[Worker] 📂 Loaded game state: ${id} (v${result.version}, ${result.scenes.length} scenes)`
          );
        }
        resolve(result || null);
      };

      request.onerror = () => {
        console.error('[Worker] Failed to get game state:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteGameState(id: string): Promise<void> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.GAMESTATE_STORE],
        'readwrite'
      );
      const store = transaction.objectStore(this.GAMESTATE_STORE);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`[Worker] 🗑️ Deleted game state: ${id}`);
        resolve();
      };

      request.onerror = () => {
        console.error('[Worker] Failed to delete game state:', request.error);
        reject(request.error);
      };
    });
  }

  async clearAllGameStates(): Promise<void> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.GAMESTATE_STORE],
        'readwrite'
      );
      const store = transaction.objectStore(this.GAMESTATE_STORE);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[Worker] 🧹 Cleared all game states');
        resolve();
      };

      request.onerror = () => {
        console.error('[Worker] Failed to clear game states:', request.error);
        reject(request.error);
      };
    });
  }

  // =============================================================================
  // DATABASE MANAGEMENT
  // =============================================================================

  async resetDatabase(): Promise<void> {
    console.log('[Worker] 🔄 Resetting IndexedDB database...');

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
        console.log(`[Worker] ✅ Deleted database: ${this.DB_NAME}`);
        resolve();
      };

      deleteRequest.onerror = () => {
        console.error('[Worker] Failed to delete database:', deleteRequest.error);
        resolve(); // Continue anyway
      };

      deleteRequest.onblocked = () => {
        console.warn(
          '[Worker] Database deletion blocked, close all tabs and try again'
        );
        resolve();
      };
    });
  }

  // =============================================================================
  // HEALTH CHECK
  // =============================================================================

  async healthCheck(): Promise<{ status: 'ok'; timestamp: number }> {
    await this.ensureInit();
    return {
      status: 'ok',
      timestamp: Date.now(),
    };
  }
}

// Create and expose the worker API
const storageWorkerAPI = new StorageWorkerAPI();
expose(storageWorkerAPI);

export type { StorageWorkerAPI };
