import { createContext } from 'react';
import { Monster, UserMonster, Encounter, MonsterType, MonsterSize } from '../types/dnd';

export interface MonsterFilters {
  search: string;
  types: MonsterType[];
  sizes: MonsterSize[];
  crMin: number;
  crMax: number;
  hasLegendaryActions: boolean | null;
  showFavoritesOnly: boolean;
  showCustomOnly: boolean;
  showSRDOnly: boolean;
}

export interface EncounterMonsterSelection {
  [monsterId: string]: number; // monsterId -> quantity
}

export interface MonsterContextType {
  // Monster data
  srdMonsters: Monster[];
  customMonsters: UserMonster[];
  allMonsters: (Monster | UserMonster)[];
  filteredMonsters: (Monster | UserMonster)[];

  // Favorites
  favoriteIds: string[];
  toggleFavorite: (monsterId: string) => Promise<void>;
  isFavorited: (monsterId: string) => boolean;

  // Custom monsters
  createCustomMonster: (monster: UserMonster) => Promise<boolean>;
  updateCustomMonster: (monster: UserMonster) => Promise<boolean>;
  deleteCustomMonster: (id: string) => Promise<boolean>;

  // Encounters
  encounters: Encounter[];
  selectedEncounterMonsters: EncounterMonsterSelection;
  encounterViewMode: 'grid' | 'tabs';
  toggleMonsterSelection: (monsterId: string) => void;
  setMonsterQuantity: (monsterId: string, quantity: number) => void;
  clearSelection: () => void;
  setEncounterViewMode: (mode: 'grid' | 'tabs') => void;
  saveEncounter: (name: string) => Promise<boolean>;
  loadEncounter: (id: string) => Promise<void>;
  deleteEncounterById: (id: string) => Promise<boolean>;

  // Filters
  filters: MonsterFilters;
  setFilters: (filters: Partial<MonsterFilters>) => void;
  clearFilters: () => void;

  // Loading states
  loading: boolean;
  error: string | null;
}

export const MonsterContext = createContext<MonsterContextType | undefined>(undefined);
