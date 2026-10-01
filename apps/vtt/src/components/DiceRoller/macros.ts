import type { ComponentType } from 'react';
import Sword from 'lucide-react/dist/esm/icons/sword';
import BowArrow from 'lucide-react/dist/esm/icons/bow-arrow';
import Flame from 'lucide-react/dist/esm/icons/flame';
import Heart from 'lucide-react/dist/esm/icons/heart';
import Skull from 'lucide-react/dist/esm/icons/skull';
import Dices from 'lucide-react/dist/esm/icons/dices';

export type MacroCategory = 'attack' | 'spell' | 'utility' | 'custom';

export interface MacroItem {
  id: string;
  label: string;
  formula: string;
  category?: MacroCategory;
  icon?: 'sword' | 'bow' | 'flame' | 'heart' | 'skull' | 'dices';
}

export const ENABLED_MACROS_KEY = 'nexus_dice_enabled_macros';
export const CUSTOM_MACROS_KEY = 'nexus_dice_custom_macros';

export const CATALOG_MACROS: MacroItem[] = [
  { id: 'attack', label: 'Melee Attack', formula: '1d20+5', category: 'attack', icon: 'sword' },
  { id: 'ranged', label: 'Ranged Attack', formula: '1d20+6', category: 'attack', icon: 'bow' },
  { id: 'sneak', label: 'Sneak Attack', formula: '3d6', category: 'attack', icon: 'sword' },
  { id: 'fireball', label: 'Fireball', formula: '8d6', category: 'spell', icon: 'flame' },
  { id: 'cure', label: 'Cure Wounds', formula: '1d8+3', category: 'spell', icon: 'heart' },
  { id: 'healing_word', label: 'Healing Word', formula: '1d4+3', category: 'spell', icon: 'heart' },
  { id: 'guiding_bolt', label: 'Guiding Bolt', formula: '4d6', category: 'spell', icon: 'flame' },
  { id: 'eldritch_blast', label: 'Eldritch Blast', formula: '1d10', category: 'spell', icon: 'flame' },
  { id: 'divine_smite', label: 'Divine Smite', formula: '2d8', category: 'spell', icon: 'flame' },
  { id: 'death_save', label: 'Death Save', formula: '1d20', category: 'utility', icon: 'skull' },
  { id: 'bardic_insp', label: 'Bardic Inspiration', formula: '1d8', category: 'utility', icon: 'dices' },
  { id: 'second_wind', label: 'Second Wind', formula: '1d10+2', category: 'utility', icon: 'heart' },
];

export const DEFAULT_ENABLED_IDS = [
  'attack',
  'sneak',
  'fireball',
  'cure',
  'death_save',
];

export type MacroIconComponent = ComponentType<{
  size?: number;
}>;

const ICONS: Record<NonNullable<MacroItem['icon']>, MacroIconComponent> = {
  sword: Sword,
  bow: BowArrow,
  flame: Flame,
  heart: Heart,
  skull: Skull,
  dices: Dices,
};

/** Icon for a macro pill; custom and unknown macros fall back to dice. */
export const macroIcon = (macro: MacroItem): MacroIconComponent =>
  (macro.icon && ICONS[macro.icon]) || Dices;

export const loadEnabledMacroIds = (): string[] => {
  try {
    const saved = localStorage.getItem(ENABLED_MACROS_KEY);
    if (!saved) return DEFAULT_ENABLED_IDS;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : DEFAULT_ENABLED_IDS;
  } catch {
    return DEFAULT_ENABLED_IDS;
  }
};

export const saveEnabledMacroIds = (ids: string[]): void => {
  try {
    localStorage.setItem(ENABLED_MACROS_KEY, JSON.stringify(ids));
  } catch (e) {
    console.warn('Failed to persist macro preferences:', e);
  }
};

export const loadCustomMacros = (): MacroItem[] => {
  try {
    const saved = localStorage.getItem(CUSTOM_MACROS_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveCustomMacros = (macros: MacroItem[]): void => {
  try {
    localStorage.setItem(CUSTOM_MACROS_KEY, JSON.stringify(macros));
  } catch (e) {
    console.warn('Failed to save custom macros:', e);
  }
};
