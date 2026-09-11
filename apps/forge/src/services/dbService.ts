import { Character, UserMonster, Encounter, NPC } from '../types/dnd';
import { IStorageService, SpellbookEntry } from './storage/IStorageService';
import { IndexedDbAdapter } from './storage/IndexedDbAdapter';

// Create a default instance for standalone mode
let currentStorage: IStorageService = new IndexedDbAdapter();

// Allow external code (e.g. NexusVTT embedding) to inject a different storage adapter
export const setStorageAdapter = (adapter: IStorageService) => {
  currentStorage = adapter;
};

// ==================== Proxy Functions ====================
// We proxy the calls to currentStorage so existing hooks do not need to be refactored immediately.

export const getAllCharacters = async (): Promise<Character[]> => currentStorage.getAllCharacters();
export const addCharacter = async (character: Character): Promise<string> => currentStorage.addCharacter(character);
export const deleteCharacter = async (id: string): Promise<void> => currentStorage.deleteCharacter(id);
export const updateCharacter = async (character: Character): Promise<void> => currentStorage.updateCharacter(character);

export const getAllCustomMonsters = async (): Promise<UserMonster[]> => currentStorage.getAllCustomMonsters();
export const addCustomMonster = async (monster: UserMonster): Promise<string> => currentStorage.addCustomMonster(monster);
export const updateCustomMonster = async (monster: UserMonster): Promise<void> => currentStorage.updateCustomMonster(monster);
export const deleteCustomMonster = async (id: string): Promise<void> => currentStorage.deleteCustomMonster(id);

export const getFavoriteMonsters = async (): Promise<string[]> => currentStorage.getFavoriteMonsters();
export const addFavorite = async (monsterId: string): Promise<void> => currentStorage.addFavorite(monsterId);
export const removeFavorite = async (monsterId: string): Promise<void> => currentStorage.removeFavorite(monsterId);
export const isFavorite = async (monsterId: string): Promise<boolean> => currentStorage.isFavorite(monsterId);

export const getAllEncounters = async (): Promise<Encounter[]> => currentStorage.getAllEncounters();
export const getEncounter = async (id: string): Promise<Encounter | undefined> => currentStorage.getEncounter(id);
export const saveEncounter = async (encounter: Encounter): Promise<string> => currentStorage.saveEncounter(encounter);
export const deleteEncounter = async (id: string): Promise<void> => currentStorage.deleteEncounter(id);

export const getAllNPCs = async (): Promise<NPC[]> => currentStorage.getAllNPCs();
export const addNPC = async (npc: NPC): Promise<string> => currentStorage.addNPC(npc);
export const updateNPC = async (npc: NPC): Promise<void> => currentStorage.updateNPC(npc);
export const deleteNPC = async (id: string): Promise<void> => currentStorage.deleteNPC(id);

export const getAllSpellbooks = async (): Promise<SpellbookEntry[]> => currentStorage.getAllSpellbooks();
export const addSpellbook = async (spellbook: SpellbookEntry): Promise<string> => currentStorage.addSpellbook(spellbook);
export const updateSpellbook = async (spellbook: SpellbookEntry): Promise<void> => currentStorage.updateSpellbook(spellbook);
export const deleteSpellbook = async (id: string): Promise<void> => currentStorage.deleteSpellbook(id);

