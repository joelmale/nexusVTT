/**
 * IndexedDB Storage Adapter
 *
 * Provides a robust, type-safe IndexedDB wrapper for local-first persistence.
 * Supports batch operations, versioning, and automatic migration.
 */

import type { StorageAdapter, IndexedDBConfig } from '@/types/hybrid';

export class IndexedDBAdapter implements StorageAdapter {
  private db: IDBDatabase | null = null;
  private dbName: string;
  private version: number;
  private config: IndexedDBConfig;
  private initPromise: Promise<void> | null = null;

  constructor(config: IndexedDBConfig) {
    this.config = config;
    this.dbName = config.dbName;
    this.version = config.version;
  }

  // =============================================================================
  // INITIALIZATION AND CONNECTION
  // =============================================================================

  private async ensureConnection(): Promise<void> {
    if (this.db && !this.db.objectStoreNames.length) {
      this.db.close();
      this.db = null;
    }

    if (this.db) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initializeDB();
    return this.initPromise;
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB is not supported in this browser'));
        return;
      }

      console.log(
        '🗄️ IndexedDB: Opening database:',
        this.dbName,
        'version:',
        this.version,
      );
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error(
          '🗄️ IndexedDB: Failed to open database:',
          request.error?.message,
        );
        reject(
          new Error(`Failed to open IndexedDB: ${request.error?.message}`),
        );
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('🗄️ IndexedDB: Database opened successfully');
        console.log(
          '🗄️ IndexedDB: Available object stores:',
          Array.from(this.db.objectStoreNames),
        );

        // Handle unexpected database closure
        this.db.onversionchange = () => {
          this.db?.close();
          this.db = null;
          console.warn('🗄️ IndexedDB: Version changed, connection closed');
        };

        this.db.onerror = (event) => {
          console.error('🗄️ IndexedDB: Database error:', event);
        };

        resolve();
      };

      request.onupgradeneeded = (event) => {
        console.log('🗄️ IndexedDB: Database upgrade needed');
        const db = (event.target as IDBOpenDBRequest).result;

        try {
          console.log(
            '🗄️ IndexedDB: Creating object stores from config:',
            this.config.stores,
          );

          // Create object stores based on configuration
          for (const storeConfig of this.config.stores) {
            console.log('🗄️ IndexedDB: Creating store:', storeConfig.name);
            if (!db.objectStoreNames.contains(storeConfig.name)) {
              const store = db.createObjectStore(storeConfig.name, {
                keyPath: storeConfig.keyPath,
                autoIncrement: !storeConfig.keyPath,
              });
              console.log('🗄️ IndexedDB: Store created:', storeConfig.name);

              // Create indexes
              if (storeConfig.indexes) {
                for (const indexConfig of storeConfig.indexes) {
                  store.createIndex(indexConfig.name, indexConfig.keyPath, {
                    unique: indexConfig.unique || false,
                  });
                  console.log(
                    '🗄️ IndexedDB: Index created:',
                    indexConfig.name,
                    'on store:',
                    storeConfig.name,
                  );
                }
              }
            } else {
              console.log(
                '🗄️ IndexedDB: Store already exists:',
                storeConfig.name,
              );
            }
          }
          console.log('🗄️ IndexedDB: All stores created successfully');
        } catch (error) {
          console.error('🗄️ IndexedDB: Failed to create object stores:', error);
          reject(new Error(`Failed to create object stores: ${error}`));
        }
      };
    });
  }

  // =============================================================================
  // BASIC CRUD OPERATIONS
  // =============================================================================

  async save(
    key: string,
    data: unknown,
    storeName: string = 'gameState',
  ): Promise<void> {
    console.log('🗄️ IndexedDB: Attempting to save:', {
      key,
      storeName,
      dataSize: JSON.stringify(data).length,
    });
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        console.error('🗄️ IndexedDB: Database not initialized for save');
        reject(new Error('Database not initialized'));
        return;
      }

      console.log(
        '🗄️ IndexedDB: Available stores before save:',
        Array.from(this.db.objectStoreNames),
      );

      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        const saveData = {
          key,
          data,
          timestamp: Date.now(),
          version: this.version,
        };

        const request = store.put(saveData);

        request.onsuccess = () => {
          console.log('🗄️ IndexedDB: Save successful:', key);
          resolve();
        };
        request.onerror = () => {
          console.error('🗄️ IndexedDB: Save failed:', request.error?.message);
          reject(new Error(`Failed to save data: ${request.error?.message}`));
        };
      } catch (error) {
        console.error(
          '🗄️ IndexedDB: Transaction creation failed for save:',
          error,
        );
        reject(error);
      }
    });
  }

  async load<T>(
    key: string,
    storeName: string = 'gameState',
  ): Promise<T | null> {
    console.log('🗄️ IndexedDB: Attempting to load:', { key, storeName });
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        console.error('🗄️ IndexedDB: Database not initialized for load');
        reject(new Error('Database not initialized'));
        return;
      }

      console.log(
        '🗄️ IndexedDB: Available stores before load:',
        Array.from(this.db.objectStoreNames),
      );

      try {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            console.log(
              '🗄️ IndexedDB: Load successful:',
              key,
              'data size:',
              JSON.stringify(result.data).length,
            );
            resolve(result.data as T);
          } else {
            console.log(
              '🗄️ IndexedDB: Load result: null (key not found):',
              key,
            );
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error('🗄️ IndexedDB: Load failed:', request.error?.message);
          reject(new Error(`Failed to load data: ${request.error?.message}`));
        };
      } catch (error) {
        console.error(
          '🗄️ IndexedDB: Transaction creation failed for load:',
          error,
        );
        reject(error);
      }
    });
  }

  async delete(key: string): Promise<void> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['gameState'], 'readwrite');
      const store = transaction.objectStore('gameState');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to delete data: ${request.error?.message}`));
    });
  }

  async clear(): Promise<void> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['gameState'], 'readwrite');
      const store = transaction.objectStore('gameState');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to clear data: ${request.error?.message}`));
    });
  }

  // =============================================================================
  // BATCH OPERATIONS
  // =============================================================================

  async saveBatch(items: Array<{ key: string; data: unknown }>): Promise<void> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['gameState'], 'readwrite');
      const store = transaction.objectStore('gameState');

      if (items.length === 0) {
        resolve();
        return;
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(new Error(`Batch save failed: ${transaction.error?.message}`));

      for (const item of items) {
        const saveData = {
          key: item.key,
          data: item.data,
          timestamp: Date.now(),
          version: this.version,
        };

        const request = store.put(saveData);

        request.onsuccess = () => {
          // Individual operation completed - transaction.oncomplete will handle the resolution
        };

        request.onerror = () => {
          reject(
            new Error(
              `Failed to save item ${item.key}: ${request.error?.message}`,
            ),
          );
        };
      }
    });
  }

  async loadBatch<T>(keys: string[]): Promise<Array<T | null>> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['gameState'], 'readonly');
      const store = transaction.objectStore('gameState');
      const results: Array<T | null> = new Array(keys.length);
      let completed = 0;

      if (keys.length === 0) {
        resolve([]);
        return;
      }

      keys.forEach((key, index) => {
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          results[index] = result ? (result.data as T) : null;
          completed++;

          if (completed === keys.length) {
            resolve(results);
          }
        };

        request.onerror = () => {
          reject(
            new Error(`Failed to load item ${key}: ${request.error?.message}`),
          );
        };
      });
    });
  }

  // =============================================================================
  // METADATA OPERATIONS
  // =============================================================================

  async exists(key: string): Promise<boolean> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['gameState'], 'readonly');
      const store = transaction.objectStore('gameState');
      const request = store.count(key);

      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () =>
        reject(
          new Error(`Failed to check existence: ${request.error?.message}`),
        );
    });
  }

  async size(): Promise<number> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['gameState'], 'readonly');
      const store = transaction.objectStore('gameState');
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error(`Failed to get size: ${request.error?.message}`));
    });
  }

  async keys(): Promise<string[]> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['gameState'], 'readonly');
      const store = transaction.objectStore('gameState');
      const request = store.getAllKeys();

      request.onsuccess = () => {
        const keys = request.result.map((key) => String(key));
        resolve(keys);
      };

      request.onerror = () =>
        reject(new Error(`Failed to get keys: ${request.error?.message}`));
    });
  }

  // =============================================================================
  // ADVANCED OPERATIONS
  // =============================================================================

  async exportData(): Promise<Record<string, unknown>> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['gameState'], 'readonly');
      const store = transaction.objectStore('gameState');
      const request = store.getAll();

      request.onsuccess = () => {
        const data: Record<string, unknown> = {};
        for (const item of request.result) {
          data[item.key] = item.data;
        }
        resolve(data);
      };

      request.onerror = () =>
        reject(new Error(`Failed to export data: ${request.error?.message}`));
    });
  }

  async importData(data: Record<string, unknown>): Promise<void> {
    const items = Object.entries(data).map(([key, value]) => ({
      key,
      data: value,
    }));
    return this.saveBatch(items);
  }

  async vacuum(): Promise<void> {
    // IndexedDB doesn't have a direct vacuum operation, but we can:
    // 1. Export all data
    // 2. Clear the database
    // 3. Re-import the data
    // This helps reclaim space from deleted records

    const data = await this.exportData();
    await this.clear();
    await this.importData(data);
  }

  // =============================================================================
  // LIFECYCLE MANAGEMENT
  // =============================================================================

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initPromise = null;
  }

  async destroy(): Promise<void> {
    await this.close();

    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(this.dbName);

      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () =>
        reject(
          new Error(
            `Failed to delete database: ${deleteRequest.error?.message}`,
          ),
        );
      deleteRequest.onblocked = () =>
        reject(new Error('Database deletion blocked'));
    });
  }
}

// =============================================================================
// FACTORY AND CONFIGURATION
// =============================================================================

export function createIndexedDBAdapter(
  config?: Partial<IndexedDBConfig>,
): IndexedDBAdapter {
  const defaultConfig: IndexedDBConfig = {
    dbName: 'nexus-vtt',
    version: 1,
    stores: [
      {
        name: 'gameState',
        keyPath: 'key',
        indexes: [
          { name: 'timestamp', keyPath: 'timestamp' },
          { name: 'version', keyPath: 'version' },
        ],
      },
      {
        name: 'metadata',
        keyPath: 'key',
      },
      {
        name: 'syncLog',
        keyPath: 'id',
        indexes: [
          { name: 'timestamp', keyPath: 'timestamp' },
          { name: 'sessionId', keyPath: 'sessionId' },
        ],
      },
    ],
  };

  return new IndexedDBAdapter({ ...defaultConfig, ...config });
}
