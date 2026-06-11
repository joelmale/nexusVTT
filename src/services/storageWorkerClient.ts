/**
 * Storage Worker Client - Main thread interface to the storage worker
 *
 * This provides the same API as dungeonMapIndexedDB but executes all operations
 * in a Web Worker to prevent main thread blocking.
 */

import { wrap, Remote } from 'comlink';
import type { StorageWorkerAPI } from '../workers/storageWorker';
import type { DungeonMapDB, GameStateDB, StorageStats } from './indexedDB';

class StorageWorkerClient {
  private worker: Worker | null = null;
  private workerAPI: Remote<StorageWorkerAPI> | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        // Create the worker
        this.worker = new Worker(
          new URL('../workers/storageWorker.ts', import.meta.url),
          { type: 'module' }
        );

        // Wrap it with Comlink
        this.workerAPI = wrap<StorageWorkerAPI>(this.worker);

        // Test connection
        await this.workerAPI.healthCheck();
        console.log('✅ Storage worker connected successfully');
      } catch (error) {
        console.error('❌ Failed to initialize storage worker:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  private async ensureInit(): Promise<Remote<StorageWorkerAPI>> {
    if (!this.workerAPI) {
      await this.init();
    }
    if (!this.workerAPI) {
      throw new Error('Storage worker not initialized');
    }
    return this.workerAPI;
  }

  // =============================================================================
  // DUNGEON MAP OPERATIONS (Proxy to worker)
  // =============================================================================

  async saveMap(mapData: Omit<DungeonMapDB, 'id'>): Promise<string> {
    const api = await this.ensureInit();
    return api.saveMap(mapData);
  }

  async getAllMaps(): Promise<DungeonMapDB[]> {
    const api = await this.ensureInit();
    return api.getAllMaps();
  }

  async getMapById(id: string): Promise<DungeonMapDB | null> {
    const api = await this.ensureInit();
    return api.getMapById(id);
  }

  async deleteMap(id: string): Promise<boolean> {
    const api = await this.ensureInit();
    return api.deleteMap(id);
  }

  async clearAll(): Promise<void> {
    const api = await this.ensureInit();
    return api.clearAllMaps();
  }

  async getStorageStats(): Promise<StorageStats> {
    const api = await this.ensureInit();
    return api.getMapStorageStats();
  }

  async cleanupOldMaps(keepCount: number = 10): Promise<number> {
    const api = await this.ensureInit();
    return api.cleanupOldMaps(keepCount);
  }

  // =============================================================================
  // GAME STATE OPERATIONS (Proxy to worker)
  // =============================================================================

  async saveGameState(
    gameState: Omit<GameStateDB, 'timestamp' | 'version'> & { id: string }
  ): Promise<void> {
    const api = await this.ensureInit();
    return api.saveGameState(gameState);
  }

  async getGameState(id: string): Promise<GameStateDB | null> {
    const api = await this.ensureInit();
    return api.getGameState(id);
  }

  async deleteGameState(id: string): Promise<void> {
    const api = await this.ensureInit();
    return api.deleteGameState(id);
  }

  async clearAllGameStates(): Promise<void> {
    const api = await this.ensureInit();
    return api.clearAllGameStates();
  }

  // =============================================================================
  // DATABASE MANAGEMENT
  // =============================================================================

  async resetDatabase(): Promise<void> {
    const api = await this.ensureInit();
    return api.resetDatabase();
  }

  // =============================================================================
  // STATIC METHODS
  // =============================================================================

  static isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Worker' in window &&
      'indexedDB' in window
    );
  }

  // =============================================================================
  // CLEANUP
  // =============================================================================

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerAPI = null;
      this.initPromise = null;
      console.log('🔌 Storage worker terminated');
    }
  }
}

// Export singleton instance
export const storageWorkerClient = new StorageWorkerClient();

// Also export class for testing
export { StorageWorkerClient };
