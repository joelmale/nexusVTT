import { loadEquipment } from '../services/dataService';
import type { Character } from '../types/dnd';

export const recalculateAC = (character: Character): number => {
  let armorClass = 10 + character.abilities.DEX.modifier; // Default unarmored

  if (character.equippedArmor) {
    const armor = loadEquipment().find(
      (eq) => eq.slug === character.equippedArmor,
    );
    if (armor?.armor_class) {
      if (armor.armor_category === 'Light') {
        armorClass = armor.armor_class.base + character.abilities.DEX.modifier;
      } else if (armor.armor_category === 'Medium') {
        const dexBonus = Math.min(
          character.abilities.DEX.modifier,
          armor.armor_class.max_bonus || 2,
        );
        armorClass = armor.armor_class.base + dexBonus;
      } else if (armor.armor_category === 'Heavy') {
        armorClass = armor.armor_class.base;
      }
    }
  }

  // Add shield bonus if equipped
  if (
    character.equippedWeapons?.some((slug) => {
      const item = loadEquipment().find((eq) => eq.slug === slug);
      return item?.armor_category === 'Shield';
    })
  ) {
    armorClass += 2;
  }

  return armorClass;
};
