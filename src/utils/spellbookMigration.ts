import { addSpellbook, getAllSpellbooks } from '../services/dbService';
import { SpellbookEntry } from '../services/storage/IStorageService';
import { log } from './logger';

/**
 * Migration helper to check if standalone spellbook-forge (SpellbookDB) exists
 * and port its spellbooks into NexusForge's IndexedDB storage.
 */
export async function migrateLegacySpellbooks(): Promise<number> {
  if (typeof indexedDB === 'undefined') return 0;

  try {
    const databases = await indexedDB.databases();
    const hasLegacyDB = databases.some((db) => db.name === 'SpellbookDB');

    if (!hasLegacyDB) return 0;

    const existingNexusBooks = await getAllSpellbooks();
    const existingIds = new Set(existingNexusBooks.map((b) => b.id));

    return new Promise((resolve) => {
      const request = indexedDB.open('SpellbookDB');

      request.onerror = () => resolve(0);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('spellbooks')) {
          db.close();
          return resolve(0);
        }

        const tx = db.transaction(['spellbooks'], 'readonly');
        const store = tx.objectStore('spellbooks');
        const getAllReq = store.getAll();

        getAllReq.onsuccess = async () => {
          const legacyBooks = getAllReq.result || [];
          let importedCount = 0;

          for (const book of legacyBooks) {
            if (book.id && !existingIds.has(String(book.id))) {
              const entry: SpellbookEntry = {
                id: String(book.id),
                name: book.name || 'Imported Spellbook',
                description: book.description,
                spells: Array.isArray(book.spells) ? book.spells : [],
                preparedSpells: Array.isArray(book.preparedSpells)
                  ? book.preparedSpells
                  : [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              await addSpellbook(entry);
              importedCount++;
            }
          }
          db.close();
          resolve(importedCount);
        };

        getAllReq.onerror = () => {
          db.close();
          resolve(0);
        };
      };
    });
  } catch (err) {
    log.warn('Spellbook migration check skipped:', { error: err });
    return 0;
  }
}
