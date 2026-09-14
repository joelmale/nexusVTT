import { Character, UserMonster, Encounter, NPC } from '../../types/dnd';
import { IStorageService, SpellbookEntry } from './IStorageService';
import { log } from '../../utils/logger';
import { initializeCharacterResources } from '../../utils/resourceUtils';

// --- IndexedDB Configuration ---
const DB_NAME = 'NexusForge';
const DB_VERSION = 13;
const STORE_NAME = 'characters';
const CUSTOM_MONSTERS_STORE = 'customMonsters';
const FAVORITES_STORE = 'favoriteMonsters';
const ENCOUNTERS_STORE = 'encounters';
const NPCS_STORE = 'npcs';
const SPELLBOOKS_STORE = 'spellbooks';

export class IndexedDbAdapter implements IStorageService {
  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: false });
            objectStore.createIndex('name', 'name', { unique: false });
            objectStore.createIndex('class', 'class', { unique: false });
            objectStore.createIndex('level', 'level', { unique: false });
          }
        }

        if (!db.objectStoreNames.contains(CUSTOM_MONSTERS_STORE)) {
          const customMonstersStore = db.createObjectStore(CUSTOM_MONSTERS_STORE, { keyPath: 'id', autoIncrement: false });
          customMonstersStore.createIndex('name', 'name', { unique: false });
          customMonstersStore.createIndex('type', 'type', { unique: false });
          customMonstersStore.createIndex('challenge_rating', 'challenge_rating', { unique: false });
        }

        if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
          db.createObjectStore(FAVORITES_STORE, { keyPath: 'monsterId', autoIncrement: false });
        }

        if (!db.objectStoreNames.contains(ENCOUNTERS_STORE)) {
          const encountersStore = db.createObjectStore(ENCOUNTERS_STORE, { keyPath: 'id', autoIncrement: false });
          encountersStore.createIndex('name', 'name', { unique: false });
          encountersStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(NPCS_STORE)) {
          const npcsStore = db.createObjectStore(NPCS_STORE, { keyPath: 'id', autoIncrement: false });
          npcsStore.createIndex('name', 'name', { unique: false });
          npcsStore.createIndex('species', 'species', { unique: false });
          npcsStore.createIndex('occupation', 'occupation', { unique: false });
          npcsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(SPELLBOOKS_STORE)) {
          const spellbooksStore = db.createObjectStore(SPELLBOOKS_STORE, { keyPath: 'id', autoIncrement: false });
          spellbooksStore.createIndex('name', 'name', { unique: false });
          spellbooksStore.createIndex('characterId', 'characterId', { unique: false });
          spellbooksStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        if (oldVersion < 3 && oldVersion > 0) {
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const characterStore = transaction.objectStore(STORE_NAME);
          const getAllRequest = characterStore.getAll();
          getAllRequest.onsuccess = () => {
            const characters = getAllRequest.result as Character[];
            characters.forEach((character) => {
              if (!character.edition) {
                character.edition = '2014';
                characterStore.put(character);
              }
            });
          };
        }

        if (oldVersion < 4 && oldVersion > 0) {
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const characterStore = transaction.objectStore(STORE_NAME);
          const getAllRequest = characterStore.getAll();
          getAllRequest.onsuccess = () => {
            const characters = getAllRequest.result as Character[];
            characters.forEach((character) => {
              if (!character.resources || character.resources.length === 0) {
                character.resources = initializeCharacterResources(character);
                characterStore.put(character);
              }
            });
          };
        }

        if (oldVersion < 5 && oldVersion > 0) {
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const characterStore = transaction.objectStore(STORE_NAME);
          const getAllRequest = characterStore.getAll();
          getAllRequest.onsuccess = () => {
            const characters = getAllRequest.result as Partial<Character>[];
            characters.forEach((character) => {
              if (character.race && !character.species) {
                character.species = character.race;
                delete character.race;
                characterStore.put(character);
              }
            });
          };
        }

        if (oldVersion < 6 && oldVersion > 0) {
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const characterStore = transaction.objectStore(STORE_NAME);
          const getAllRequest = characterStore.getAll();
          getAllRequest.onsuccess = () => {
            const characters = getAllRequest.result as Partial<Character>[];
            characters.forEach((character) => {
              if (character.class === 'Bard' && !character.featuresAndTraits?.musicalInstrumentProficiencies) {
                if (!character.featuresAndTraits) {
                  character.featuresAndTraits = {
                    personality: '',
                    ideals: '',
                    bonds: '',
                    flaws: '',
                    classFeatures: [],
                    speciesTraits: [],
                    backgroundFeatures: [],
                    musicalInstrumentProficiencies: []
                  };
                } else {
                  character.featuresAndTraits.musicalInstrumentProficiencies = [];
                }
                characterStore.put(character);
              }
            });
          };
        }

        if (oldVersion < 7 && oldVersion > 0) {
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const characterStore = transaction.objectStore(STORE_NAME);
          const getAllRequest = characterStore.getAll();
          getAllRequest.onsuccess = () => {
            const characters = getAllRequest.result as Partial<Character>[];
            characters.forEach((character) => {
              let updated = false;
              if (!character.edition) {
                character.edition = '2014';
                updated = true;
              }
              if (!character.species && character.race) {
                 character.species = character.race;
                 updated = true;
              }
              if (updated) {
                characterStore.put(character);
              }
            });
          };
        }
      };
    });
  }

  private ensureCharacterHasEdition(character: Character): Character {
    if (!character.edition) {
      log.warn('Character loaded without edition; defaulting to 2014', { characterId: character.id, name: character.name });
      return {
        ...character,
        edition: '2014',
      };
    }
    return character;
  }

  // ==================== Characters ====================
  async getAllCharacters(): Promise<Character[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const characters = (request.result as Character[]).map(c => this.ensureCharacterHasEdition(c));
        resolve(characters);
      };
    });
  }

  async addCharacter(character: Character): Promise<string> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.add(character);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(character.id);
    });
  }

  async updateCharacter(character: Character): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.put(character);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async deleteCharacter(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // ==================== Custom Monsters ====================
  async getAllCustomMonsters(): Promise<UserMonster[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CUSTOM_MONSTERS_STORE], 'readonly');
      const objectStore = transaction.objectStore(CUSTOM_MONSTERS_STORE);
      const request = objectStore.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async addCustomMonster(monster: UserMonster): Promise<string> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CUSTOM_MONSTERS_STORE], 'readwrite');
      const objectStore = transaction.objectStore(CUSTOM_MONSTERS_STORE);
      const request = objectStore.add(monster);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(monster.id);
    });
  }

  async updateCustomMonster(monster: UserMonster): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CUSTOM_MONSTERS_STORE], 'readwrite');
      const objectStore = transaction.objectStore(CUSTOM_MONSTERS_STORE);
      const request = objectStore.put(monster);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async deleteCustomMonster(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CUSTOM_MONSTERS_STORE], 'readwrite');
      const objectStore = transaction.objectStore(CUSTOM_MONSTERS_STORE);
      const request = objectStore.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // ==================== Favorites ====================
  async getFavoriteMonsters(): Promise<string[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([FAVORITES_STORE], 'readonly');
      const objectStore = transaction.objectStore(FAVORITES_STORE);
      const request = objectStore.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }

  async addFavorite(monsterId: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([FAVORITES_STORE], 'readwrite');
      const objectStore = transaction.objectStore(FAVORITES_STORE);
      const request = objectStore.add({ monsterId, createdAt: Date.now() });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async removeFavorite(monsterId: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([FAVORITES_STORE], 'readwrite');
      const objectStore = transaction.objectStore(FAVORITES_STORE);
      const request = objectStore.delete(monsterId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async isFavorite(monsterId: string): Promise<boolean> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([FAVORITES_STORE], 'readonly');
      const objectStore = transaction.objectStore(FAVORITES_STORE);
      const request = objectStore.get(monsterId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(!!request.result);
    });
  }

  // ==================== Encounters ====================
  async getAllEncounters(): Promise<Encounter[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ENCOUNTERS_STORE], 'readonly');
      const objectStore = transaction.objectStore(ENCOUNTERS_STORE);
      const request = objectStore.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getEncounter(id: string): Promise<Encounter | undefined> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ENCOUNTERS_STORE], 'readonly');
      const objectStore = transaction.objectStore(ENCOUNTERS_STORE);
      const request = objectStore.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async saveEncounter(encounter: Encounter): Promise<string> {
    if (!encounter.id || !encounter.name || !Array.isArray(encounter.monsterIds)) {
      throw new Error('Invalid encounter data: missing required fields');
    }
    if (encounter.monsterIds.length === 0) {
      throw new Error('Cannot save encounter with no monsters');
    }
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(ENCOUNTERS_STORE)) {
        reject(new Error('Database not properly initialized.'));
        return;
      }
      const transaction = db.transaction([ENCOUNTERS_STORE], 'readwrite');
      const objectStore = transaction.objectStore(ENCOUNTERS_STORE);
      const request = objectStore.put(encounter);
      request.onerror = () => reject(new Error('Save failed'));
      request.onsuccess = () => resolve(encounter.id);
    });
  }

  async deleteEncounter(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ENCOUNTERS_STORE], 'readwrite');
      const objectStore = transaction.objectStore(ENCOUNTERS_STORE);
      const request = objectStore.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // ==================== NPCs ====================
  async getAllNPCs(): Promise<NPC[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([NPCS_STORE], 'readonly');
      const objectStore = transaction.objectStore(NPCS_STORE);
      const request = objectStore.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async addNPC(npc: NPC): Promise<string> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([NPCS_STORE], 'readwrite');
      const objectStore = transaction.objectStore(NPCS_STORE);
      const request = objectStore.add(npc);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(npc.id);
    });
  }

  async updateNPC(npc: NPC): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([NPCS_STORE], 'readwrite');
      const objectStore = transaction.objectStore(NPCS_STORE);
      const request = objectStore.put(npc);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async deleteNPC(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([NPCS_STORE], 'readwrite');
      const objectStore = transaction.objectStore(NPCS_STORE);
      const request = objectStore.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // ==================== Spellbooks ====================
  async getAllSpellbooks(): Promise<SpellbookEntry[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SPELLBOOKS_STORE], 'readonly');
      const objectStore = transaction.objectStore(SPELLBOOKS_STORE);
      const request = objectStore.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve((request.result as SpellbookEntry[]) || []);
    });
  }

  async addSpellbook(spellbook: SpellbookEntry): Promise<string> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SPELLBOOKS_STORE], 'readwrite');
      const objectStore = transaction.objectStore(SPELLBOOKS_STORE);
      const request = objectStore.add(spellbook);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(spellbook.id);
    });
  }

  async updateSpellbook(spellbook: SpellbookEntry): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SPELLBOOKS_STORE], 'readwrite');
      const objectStore = transaction.objectStore(SPELLBOOKS_STORE);
      const request = objectStore.put(spellbook);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async deleteSpellbook(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SPELLBOOKS_STORE], 'readwrite');
      const objectStore = transaction.objectStore(SPELLBOOKS_STORE);
      const request = objectStore.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}
