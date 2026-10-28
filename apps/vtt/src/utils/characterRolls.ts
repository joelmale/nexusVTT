import type {
  AbilityKey,
  Character,
  InventoryItem,
  Weapon,
} from '@nexus/character-contracts';
import { ABILITY_KEYS } from '@nexus/character-contracts';

/**
 * Roll and modifier math shared by the full character sheet and the Simple
 * Player Mode sheet, so both show the same numbers.
 */

export { ABILITY_KEYS };

export function formatModifier(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

export function proficiencyBonus(character: Character): number {
  return character.proficiencyBonus ?? 2;
}

export function abilityModifier(
  character: Character,
  ability: AbilityKey,
): number {
  return character.abilities[ability]?.modifier ?? 0;
}

export function savingThrowBonus(
  character: Character,
  ability: AbilityKey,
): number {
  const proficient = character.savingThrowProficiencies?.[ability] ?? false;
  return (
    abilityModifier(character, ability) +
    (proficient ? proficiencyBonus(character) : 0)
  );
}

/** A d20 expression with a flat bonus, e.g. `1d20+5`, `1d20-1`, `1d20`. */
export function d20Expression(bonus: number): string {
  if (bonus === 0) return '1d20';
  return `1d20${formatModifier(bonus)}`;
}

/** Appends a flat modifier to a damage expression, e.g. `1d8` + 3 → `1d8+3`. */
export function withModifier(dice: string, modifier: number): string {
  if (modifier === 0) return dice;
  return `${dice}${formatModifier(modifier)}`;
}

export interface WeaponAttack {
  id: string;
  name: string;
  toHit: number;
  damage: string;
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findWeapon(
  item: InventoryItem,
  weapons: Weapon[],
): Weapon | undefined {
  const slug = normalise(item.equipmentSlug);
  const name = item.name ? normalise(item.name) : undefined;
  return weapons.find((weapon) => {
    const id = normalise(weapon.id);
    const weaponName = normalise(weapon.name);
    return (
      id === slug ||
      weaponName === slug ||
      slug.endsWith(id) ||
      (name !== undefined && weaponName === name)
    );
  });
}

/**
 * Attacks for the character's equipped weapons. Melee uses STR, ranged uses
 * DEX, and finesse weapons use the better of the two; proficiency is assumed,
 * as the sheet does not track weapon proficiency per item.
 */
export function weaponAttacks(
  character: Character,
  weapons: Weapon[],
): WeaponAttack[] {
  const attacks: WeaponAttack[] = [];
  for (const item of character.inventory ?? []) {
    if (!item.equipped) continue;
    const weapon = findWeapon(item, weapons);
    if (!weapon) continue;

    const str = abilityModifier(character, 'STR');
    const dex = abilityModifier(character, 'DEX');
    const mod = weapon.properties.includes('finesse')
      ? Math.max(str, dex)
      : weapon.category === 'ranged'
        ? dex
        : str;

    attacks.push({
      id: item.equipmentSlug,
      name: item.name ?? weapon.name,
      toHit: mod + proficiencyBonus(character),
      damage: withModifier(weapon.damage, mod),
    });
  }
  return attacks;
}
