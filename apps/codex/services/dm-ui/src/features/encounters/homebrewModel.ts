import type { HomebrewMonster } from '@/demo/fixture-registry';
import type { CatalogMonster } from './monsterCatalog';

export const CR_OPTIONS = [
  '0',
  '1/8',
  '1/4',
  '1/2',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
] as const;

export const MONSTER_SIZES = [
  'Tiny',
  'Small',
  'Medium',
  'Large',
  'Huge',
  'Gargantuan',
] as const;

export const MONSTER_TYPES = [
  'aberration',
  'beast',
  'celestial',
  'construct',
  'dragon',
  'elemental',
  'fey',
  'fiend',
  'giant',
  'humanoid',
  'monstrosity',
  'ooze',
  'plant',
  'undead',
] as const;

export const ABILITY_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

/** Standard XP awards by Challenge Rating in 5e (2014 & 2024). */
export const CR_XP_MAP: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};

export function xpForCr(cr: string): number {
  return CR_XP_MAP[cr.trim()] ?? 0;
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(score: number): string {
  const mod = abilityModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export interface HomebrewFilter {
  query?: string;
  type?: string;
  cr?: string;
}

export function filterHomebrewMonsters(
  monsters: readonly HomebrewMonster[],
  { query = '', type = 'all', cr = 'all' }: HomebrewFilter = {},
): HomebrewMonster[] {
  const needle = query.trim().toLowerCase();
  return monsters.filter((monster) => {
    if (type !== 'all' && monster.type.toLowerCase() !== type.toLowerCase()) {
      return false;
    }
    if (cr !== 'all' && monster.cr !== cr) {
      return false;
    }
    if (needle) {
      const matchName = monster.name.toLowerCase().includes(needle);
      const matchType = monster.type.toLowerCase().includes(needle);
      const matchNotes = (monster.notes ?? '').toLowerCase().includes(needle);
      if (!matchName && !matchType && !matchNotes) return false;
    }
    return true;
  });
}

export function cloneMonsterDraft(
  source: Partial<CatalogMonster> | Partial<HomebrewMonster>,
): Omit<HomebrewMonster, 'id' | 'campaignId'> {
  const name = source.name ? `${source.name} (Custom)` : 'New Creature';
  return {
    name,
    size: source.size || 'Medium',
    type: source.type || 'humanoid',
    cr: source.cr || '1',
    ac: typeof source.ac === 'number' ? source.ac : 12,
    hp: typeof source.hp === 'number' ? source.hp : 20,
    speed: typeof source.speed === 'number' ? source.speed : 30,
    abilities: (source.abilities && source.abilities.length === 6
      ? source.abilities
      : [10, 10, 10, 10, 10, 10]) as HomebrewMonster['abilities'],
    edition: source.edition === '2014' ? '2014' : '2024',
    notes: (source as HomebrewMonster).notes ?? '',
  };
}
