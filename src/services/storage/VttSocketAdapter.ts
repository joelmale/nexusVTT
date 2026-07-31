import { Character, UserMonster, Encounter, NPC } from '../../types/dnd';
import { IStorageService, SpellbookEntry } from './IStorageService';

/**
 * VttSocketAdapter
 * 
 * This adapter is used when NexusForge is embedded within NexusVTT.
 * It delegates storage operations to the VTT via custom events or an injected API.
 * In a Module Federation setup, the host (NexusVTT) can also just implement IStorageService
 * directly and inject it via `setStorageAdapter`.
 */
export class VttSocketAdapter implements IStorageService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private vttApi: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(vttApi?: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.vttApi = vttApi || (window as any).NexusVTT_API;
    
    if (!this.vttApi) {
      // eslint-disable-next-line no-console
      console.warn('VttSocketAdapter initialized without vttApi. Operations may fail.');
    }
  }

  // ==================== Characters ====================
  async getAllCharacters(): Promise<Character[]> {
    if (this.vttApi?.getAllCharacters) {
      return this.vttApi.getAllCharacters();
    }
    return [];
  }

  async addCharacter(character: Character): Promise<string> {
    if (this.vttApi?.addCharacter) {
      return this.vttApi.addCharacter(character);
    }
    return character.id;
  }

  async updateCharacter(character: Character): Promise<void> {
    if (this.vttApi?.updateCharacter) {
      return this.vttApi.updateCharacter(character);
    }
  }

  async deleteCharacter(id: string): Promise<void> {
    if (this.vttApi?.deleteCharacter) {
      return this.vttApi.deleteCharacter(id);
    }
  }

  // ==================== Custom Monsters ====================
  async getAllCustomMonsters(): Promise<UserMonster[]> { return []; }
  async addCustomMonster(monster: UserMonster): Promise<string> { return monster.id; }
  async updateCustomMonster(_monster: UserMonster): Promise<void> {}
  async deleteCustomMonster(_id: string): Promise<void> {}

  // ==================== Favorites ====================
  async getFavoriteMonsters(): Promise<string[]> { return []; }
  async addFavorite(_monsterId: string): Promise<void> {}
  async removeFavorite(_monsterId: string): Promise<void> {}
  async isFavorite(_monsterId: string): Promise<boolean> { return false; }

  // ==================== Encounters ====================
  async getAllEncounters(): Promise<Encounter[]> { return []; }
  async getEncounter(_id: string): Promise<Encounter | undefined> { return undefined; }
  async saveEncounter(encounter: Encounter): Promise<string> { return encounter.id; }
  async deleteEncounter(_id: string): Promise<void> {}

  // ==================== NPCs ====================
  async getAllNPCs(): Promise<NPC[]> { return []; }
  async addNPC(npc: NPC): Promise<string> { return npc.id; }
  async updateNPC(_npc: NPC): Promise<void> {}
  async deleteNPC(_id: string): Promise<void> {}

  // ==================== Spellbooks ====================
  async getAllSpellbooks(): Promise<SpellbookEntry[]> {
    if (this.vttApi?.getAllSpellbooks) {
      return this.vttApi.getAllSpellbooks();
    }
    return [];
  }
  async addSpellbook(spellbook: SpellbookEntry): Promise<string> {
    if (this.vttApi?.addSpellbook) {
      return this.vttApi.addSpellbook(spellbook);
    }
    return spellbook.id;
  }
  async updateSpellbook(spellbook: SpellbookEntry): Promise<void> {
    if (this.vttApi?.updateSpellbook) {
      return this.vttApi.updateSpellbook(spellbook);
    }
  }
  async deleteSpellbook(id: string): Promise<void> {
    if (this.vttApi?.deleteSpellbook) {
      return this.vttApi.deleteSpellbook(id);
    }
  }
}
