import { Character, Equipment, AbilityName } from '../types/dnd';
import { loadEquipment } from '../services/dataService';
import { BASE_ARMOR_CLASS, SHIELD_AC_BONUS, MAX_DEX_BONUS_MEDIUM_ARMOR } from '../constants/combat';

const EQUIPMENT_DATABASE: Equipment[] = loadEquipment();

export interface EquipmentBonuses {
  armorClass: number;
  abilityModifiers: Record<AbilityName, number>;
  savingThrowModifiers: Record<AbilityName, number>;
  skillModifiers: Record<string, number>;
  speedModifier: number;
  initiativeModifier: number;
  hitPointModifier: number;
  proficiencyBonus: number;
}

/**
 * Calculate all equipment-based bonuses for a character.
 *
 * This function analyzes a character's equipped items (armor, weapons, shields)
 * and calculates various bonuses they provide. Currently focused on armor class
 * calculation, with infrastructure for future enhancements to handle magical items.
 *
 * **Current Implementation**:
 * - Calculates armor class from equipped armor and shields
 * - Returns structure with all bonus categories (most currently set to 0)
 *
 * **Future Enhancements**:
 * - Parse magical item descriptions for bonuses (+1 armor, +2 weapons, etc.)
 * - Apply ability score bonuses from items (Gauntlets of Ogre Power, Headband of Intellect)
 * - Apply skill bonuses from items (Boots of Elvenkind)
 * - Apply speed modifiers (Boots of Speed)
 *
 * @param character - The character to calculate equipment bonuses for
 *
 * @returns EquipmentBonuses object containing:
 *          - `armorClass`: Calculated AC from armor and shields
 *          - `abilityModifiers`: Ability score bonuses from magical items (future)
 *          - `savingThrowModifiers`: Saving throw bonuses from items (future)
 *          - `skillModifiers`: Skill check bonuses from items (future)
 *          - `speedModifier`: Speed bonuses/penalties from equipment (future)
 *          - `initiativeModifier`: Initiative bonuses from items (future)
 *          - `hitPointModifier`: HP bonuses from items (future)
 *          - `proficiencyBonus`: Proficiency bonuses from items (future)
 *
 * @example
 * ```typescript
 * const bonuses = calculateEquipmentBonuses(character);
 * // Returns: {
 * //   armorClass: 16,  // Calculated from chain mail + shield
 * //   abilityModifiers: { STR: 0, DEX: 0, ... },  // All 0 for now
 * //   savingThrowModifiers: { STR: 0, DEX: 0, ... },
 * //   skillModifiers: {},
 * //   speedModifier: 0,
 * //   initiativeModifier: 0,
 * //   hitPointModifier: 0,
 * //   proficiencyBonus: 0
 * // }
 * ```
 */
export const calculateEquipmentBonuses = (character: Character): EquipmentBonuses => {
  const bonuses: EquipmentBonuses = {
    armorClass: 0,
    abilityModifiers: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
    savingThrowModifiers: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
    skillModifiers: {},
    speedModifier: 0,
    initiativeModifier: 0,
    hitPointModifier: 0,
    proficiencyBonus: 0
  };

  // Calculate AC from equipped armor and shields
  bonuses.armorClass = calculateACBonus(character);

  // Calculate bonuses from all equipped items
  const allEquippedItems = getAllEquippedItems(character);

  allEquippedItems.forEach(_item => {
    // For now, we'll focus on basic AC calculation
    // Future enhancement: parse item descriptions for magical bonuses
    // This would require natural language processing or structured bonus data
  });

  return bonuses;
};

/**
 * Recalculate armor class for a character.
 *
 * This is a convenience wrapper around `calculateACBonus` used when you need
 * to quickly recalculate AC after equipment changes (equipping/unequipping armor
 * or shields). Returns just the AC value without the full equipment bonuses structure.
 *
 * **Common use cases**:
 * - After equipping new armor
 * - After unequipping armor or shield
 * - After ability score changes (DEX modifier affects AC)
 * - After leveling up (if DEX increases)
 *
 * @param character - The character to recalculate AC for
 *
 * @returns The character's current armor class value
 *
 * @example
 * ```typescript
 * // After equipping chain mail
 * const newAC = recalculateAC(character);
 * character.armorClass = newAC;
 *
 * // After increasing DEX from 14 to 16
 * character.abilities.DEX.modifier = 3;
 * character.armorClass = recalculateAC(character);
 * ```
 */
export const recalculateAC = (character: Character): number => {
  return calculateACBonus(character);
};

/**
 * Calculate armor class bonus from equipped armor and shields.
 *
 * This function implements D&D 5e armor class calculation rules:
 *
 * **Unarmored**: 10 + DEX modifier
 *
 * **Light Armor**: Base AC + full DEX modifier
 * - Examples: Leather (11 + DEX), Studded Leather (12 + DEX)
 *
 * **Medium Armor**: Base AC + DEX modifier (max +2)
 * - Examples: Hide (12 + DEX max 2), Chain Shirt (13 + DEX max 2), Half Plate (15 + DEX max 2)
 *
 * **Heavy Armor**: Base AC only (no DEX bonus)
 * - Examples: Ring Mail (14), Chain Mail (16), Plate (18)
 *
 * **Shield**: +2 AC bonus when equipped in weapon slot
 *
 * @param character - The character to calculate AC for
 *
 * @returns The calculated armor class value
 *
 * @example
 * ```typescript
 * // Example 1: Unarmored Monk with DEX 18 (+4)
 * // AC = 10 + 4 = 14
 *
 * // Example 2: Rogue in Leather Armor (AC 11) with DEX 18 (+4)
 * // AC = 11 + 4 = 15
 *
 * // Example 3: Fighter in Half Plate (AC 15) with DEX 16 (+3)
 * // AC = 15 + 2 = 17  (DEX capped at +2 for medium armor)
 *
 * // Example 4: Paladin in Plate Armor (AC 18) with Shield
 * // AC = 18 + 2 = 20  (Heavy armor = no DEX, shield = +2)
 * ```
 */
const calculateACBonus = (character: Character): number => {
  let armorClass = BASE_ARMOR_CLASS + character.abilities.DEX.modifier; // Default unarmored

  if (character.equippedArmor) {
    const armor = EQUIPMENT_DATABASE.find(eq => eq.slug === character.equippedArmor);
    if (armor?.armor_class) {
      if (armor.armor_category === 'Light') {
        armorClass = armor.armor_class.base + character.abilities.DEX.modifier;
      } else if (armor.armor_category === 'Medium') {
        const dexBonus = Math.min(character.abilities.DEX.modifier, armor.armor_class.max_bonus || MAX_DEX_BONUS_MEDIUM_ARMOR);
        armorClass = armor.armor_class.base + dexBonus;
      } else if (armor.armor_category === 'Heavy') {
        armorClass = armor.armor_class.base;
      }
    }
  }

  // Add shield bonus if equipped
  if (character.equippedWeapons?.some(slug => {
    const item = EQUIPMENT_DATABASE.find(eq => eq.slug === slug);
    return item?.armor_category === 'Shield';
  })) {
    armorClass += SHIELD_AC_BONUS;
  }

  return armorClass;
};

const getAllEquippedItems = (character: Character): Equipment[] => {
  const equippedItems: Equipment[] = [];

  // Add equipped armor
  if (character.equippedArmor) {
    const armor = EQUIPMENT_DATABASE.find(eq => eq.slug === character.equippedArmor);
    if (armor) equippedItems.push(armor);
  }

  // Add equipped weapons
  if (character.equippedWeapons) {
    character.equippedWeapons.forEach(slug => {
      const weapon = EQUIPMENT_DATABASE.find(eq => eq.slug === slug);
      if (weapon) equippedItems.push(weapon);
    });
  }

  return equippedItems;
};