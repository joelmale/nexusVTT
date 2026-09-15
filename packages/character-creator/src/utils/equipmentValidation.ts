import { Character, Equipment } from '../types/dnd';
import { loadEquipment } from '../services/dataService';

const EQUIPMENT_DATABASE: Equipment[] = loadEquipment();

export interface EquipmentValidationResult {
  canEquip: boolean;
  reason?: string;
  conflicts?: string[];
}

/**
 * Validates if a character can equip a specific item
 */
export const canEquipItem = (character: Character, equipment: Equipment): EquipmentValidationResult => {
  const result: EquipmentValidationResult = {
    canEquip: true,
    conflicts: []
  };

  // Check strength requirements for armor
  if (equipment.armor_category && equipment.str_minimum) {
    if (character.abilities.STR.score < equipment.str_minimum) {
      result.canEquip = false;
      result.reason = `Requires ${equipment.str_minimum} Strength (you have ${character.abilities.STR.score})`;
      return result;
    }
  }

  // Check armor category conflicts
  if (equipment.equipment_category === 'Armor' && equipment.armor_category !== 'Shield') {
    // Can't equip multiple armor types
    if (character.equippedArmor) {
      const currentArmor = EQUIPMENT_DATABASE.find(eq => eq.slug === character.equippedArmor);
      if (currentArmor && currentArmor.armor_category !== equipment.armor_category) {
        result.canEquip = false;
        result.reason = `Cannot equip ${equipment.armor_category} armor while wearing ${currentArmor.armor_category} armor`;
        result.conflicts?.push(character.equippedArmor);
        return result;
      }
    }
  }

  // Check weapon limits (max 2 equipped weapons)
  if (equipment.equipment_category === 'Weapon') {
    const equippedWeapons = character.equippedWeapons || [];
    if (!character.equippedWeapons?.includes(equipment.slug)) {
      if (equippedWeapons.length >= 2) {
        result.canEquip = false;
        result.reason = 'Cannot equip more than 2 weapons';
        return result;
      }
    }
  }

  // Check shield compatibility
  if (equipment.armor_category === 'Shield') {
    const equippedWeapons = character.equippedWeapons || [];
    // Check if any equipped weapon requires two hands
    for (const weaponSlug of equippedWeapons) {
      const weapon = EQUIPMENT_DATABASE.find(eq => eq.slug === weaponSlug);
      if (weapon?.properties?.some(prop => prop.name === 'Two-Handed')) {
        result.canEquip = false;
        result.reason = 'Cannot use shield with two-handed weapons';
        result.conflicts?.push(weaponSlug);
        return result;
      }
    }
  }

  // Check if weapon requires two hands and we have a shield equipped
  if (equipment.equipment_category === 'Weapon' && equipment.properties?.some(prop => prop.name === 'Two-Handed')) {
    const equippedWeapons = character.equippedWeapons || [];
    const hasShield = equippedWeapons.some(slug => {
      const item = EQUIPMENT_DATABASE.find(eq => eq.slug === slug);
      return item?.armor_category === 'Shield';
    });

    if (hasShield) {
      result.canEquip = false;
      result.reason = 'Two-handed weapons cannot be used with shields';
      // Find the shield and add it to conflicts
      const shieldSlug = equippedWeapons.find(slug => {
        const item = EQUIPMENT_DATABASE.find(eq => eq.slug === slug);
        return item?.armor_category === 'Shield';
      });
      if (shieldSlug) {
        result.conflicts?.push(shieldSlug);
      }
      return result;
    }
  }

  return result;
};

/**
 * Validates if a character can unequip an item
 */
export const canUnequipItem = (_character: Character, _equipmentSlug: string): EquipmentValidationResult => {
  // Generally, unequipping is always allowed
  return { canEquip: true };
};

/**
 * Gets all equipment conflicts when equipping an item
 */
export const getEquipmentConflicts = (character: Character, equipment: Equipment): string[] => {
  const validation = canEquipItem(character, equipment);
  return validation.conflicts || [];
};

/**
 * Checks if equipping an item would cause any conflicts
 */
export const hasEquipmentConflicts = (character: Character, equipment: Equipment): boolean => {
  return getEquipmentConflicts(character, equipment).length > 0;
};