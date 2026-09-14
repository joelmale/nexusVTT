import React from 'react';
import { NPC } from '../types/dnd';

export interface NPCContextType {
  // State
  npcs: NPC[];
  filteredNPCs: NPC[];
  loading: boolean;
  error: string | null;

  // CRUD operations
  createNPC: (npc: NPC) => Promise<boolean>;
  updateNPC: (npc: NPC) => Promise<boolean>;
  deleteNPC: (id: string) => Promise<boolean>;

  // Filtering
  filters: NPCFilters;
  setFilters: (filters: Partial<NPCFilters>) => void;
  clearFilters: () => void;
}

export interface NPCFilters {
  search: string;
  species: string[];
  occupations: string[];
  alignments: string[];
}

export const DEFAULT_NPC_FILTERS: NPCFilters = {
  search: '',
  species: [],
  occupations: [],
  alignments: [],
};

export const NPCContext = React.createContext<NPCContextType | undefined>(undefined);