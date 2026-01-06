type SyncSource = 'character' | 'token' | 'initiative';

interface StatUpdate {
  characterId?: string;
  tokenId?: string;
  initiativeEntryId?: string;
  stats: {
    currentHP?: number;
    tempHP?: number;
    maxHP?: number;
    armorClass?: number;
  };
}

class CharacterSyncService {
  syncStats(_source: SyncSource, _update: StatUpdate): void {
    // No-op placeholder to keep unit tests and optional sync hooks stable.
  }
}

export const characterSyncService = new CharacterSyncService();
