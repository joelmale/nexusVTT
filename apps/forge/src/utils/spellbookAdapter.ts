import {
  Shield,
  Wand2,
  Eye,
  Heart,
  Flame,
  Sparkles,
  Skull,
  Shuffle,
  LucideIcon
} from 'lucide-react';
import { AppSpell } from '../services/dataService';

export const schoolIcons: Record<string, LucideIcon> = {
  abjuration: Shield,
  conjuration: Wand2,
  divination: Eye,
  enchantment: Heart,
  evocation: Flame,
  illusion: Sparkles,
  necromancy: Skull,
  transmutation: Shuffle,
};

export const schoolColors: Record<string, string> = {
  abjuration: 'bg-blue-900/40 border-blue-700 text-blue-300',
  conjuration: 'bg-green-900/40 border-green-700 text-green-300',
  divination: 'bg-purple-900/40 border-purple-700 text-purple-300',
  enchantment: 'bg-pink-900/40 border-pink-700 text-pink-300',
  evocation: 'bg-red-900/40 border-red-700 text-red-300',
  illusion: 'bg-indigo-900/40 border-indigo-700 text-indigo-300',
  necromancy: 'bg-gray-800/60 border-gray-600 text-gray-300',
  transmutation: 'bg-amber-900/40 border-amber-700 text-amber-300',
};

export interface SpellFilterState {
  searchTerm: string;
  editionFilter: 'all' | '2014' | '2024';
  selectedLevel: 'all' | string;
  selectedSchools: string[];
  filterRitual: boolean;
  filterConcentration: boolean;
  filterFavorites: boolean;
  favoriteSlugs: string[];
}

export function filterAppSpells(spells: AppSpell[], filters: SpellFilterState): AppSpell[] {
  const term = filters.searchTerm.trim().toLowerCase();

  return spells.filter((spell) => {
    if (filters.editionFilter !== 'all' && spell.source !== filters.editionFilter) {
      return false;
    }
    if (filters.selectedLevel !== 'all' && spell.level !== Number(filters.selectedLevel)) {
      return false;
    }
    if (
      filters.selectedSchools.length > 0 &&
      !filters.selectedSchools.includes(spell.school.toLowerCase())
    ) {
      return false;
    }
    if (filters.filterRitual && !spell.ritual) {
      return false;
    }
    if (filters.filterConcentration && !spell.concentration) {
      return false;
    }
    if (filters.filterFavorites && !filters.favoriteSlugs.includes(spell.slug)) {
      return false;
    }
    if (!term) {
      return true;
    }
    const haystack = `${spell.name} ${spell.school} ${(spell.classes || []).join(' ')}`.toLowerCase();
    return haystack.includes(term);
  });
}
