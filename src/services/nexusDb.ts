/**
 * NexusVTT unified IndexedDB ownership and connection logic.
 */

export const DB_NAME = 'NexusVTT';
// v5: Added tempStorage for generator
// v6: Unified owner repair and schema versioning
export const DB_VERSION = 6;

export interface StoreDescriptor {
  name: string;
  keyPath: string;
  indexes?: { name: string; keyPath: string; unique: boolean }[];
}

export const STORES: Record<string, StoreDescriptor> = {
  MAPS: {
    name: 'maps',
    keyPath: 'id',
    indexes: [
      { name: 'timestamp', keyPath: 'timestamp', unique: false },
      { name: 'name', keyPath: 'name', unique: false },
    ],
  },
  GAME_STATE: {
    name: 'gameState',
    keyPath: 'id',
  },
  TEMP_STORAGE: {
    name: 'tempStorage',
    keyPath: 'id',
    // Note: tempStorage is considered disposable for the legacy Dungeon Generator.
    // It will be retired once the Generator Hub migration is complete.
  },
};

let activeDb: IDBDatabase | null = null;
let currentDbVersion = DB_VERSION;

/**
 * Ensures a store exists on the database during an upgrade transaction.
 */
function ensureStore(db: IDBDatabase, descriptor: StoreDescriptor) {
  if (!db.objectStoreNames.contains(descriptor.name)) {
    const store = db.createObjectStore(descriptor.name, { keyPath: descriptor.keyPath });
    if (descriptor.indexes) {
      for (const index of descriptor.indexes) {
        store.createIndex(index.name, index.keyPath, { unique: index.unique });
      }
    }
    console.log(`✅ Created ${descriptor.name} store`);
  }
}

/**
 * Checks if the database is missing any required stores.
 * If so, it returns true, indicating a version bump is needed for repair.
 */
async function needsRepair(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => {
      const db = request.result;
      const storeNames = Array.from(db.objectStoreNames);
      db.close();

      const missing = Object.values(STORES).some(
        (store) => !storeNames.includes(store.name),
      );
      resolve(missing);
    };
    request.onerror = () => {
      resolve(false); // If it fails to open, it will trigger an upgrade anyway or fail properly
    };
  });
}

/**
 * Bumps the requested version to trigger an onupgradeneeded event to create missing stores,
 * without deleting user data (maps or game state).
 */
export async function repairMissingStores(): Promise<void> {
  if (await needsRepair()) {
    console.warn(`⚠️ Database missing required stores. Bumping version for repair...`);
    currentDbVersion += 1;
  }
}

export async function openNexusDB(): Promise<IDBDatabase> {
  if (activeDb) {
    return activeDb;
  }

  await repairMissingStores();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, currentDbVersion);

    request.onblocked = () => {
      console.warn(`⚠️ IndexedDB open blocked. Please close other NexusVTT tabs and refresh.`);
      reject(new Error('Database upgrade blocked by another tab. Please close other tabs and refresh.'));
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      console.log(`🔧 IndexedDB upgrade: v${event.oldVersion} → v${event.newVersion}`);

      // Idempotent upgrade logic
      for (const store of Object.values(STORES)) {
        ensureStore(db, store);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      
      db.onversionchange = () => {
        console.warn('⚠️ Database version change requested by another tab. Closing connection to allow upgrade.');
        db.close();
        activeDb = null;
      };

      activeDb = db;
      resolve(db);
    };

    request.onerror = () => {
      console.error('❌ Failed to open IndexedDB:', request.error);
      reject(request.error);
    };
  });
}
