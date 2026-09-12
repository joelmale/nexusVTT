import { EquipmentChoice, EquipmentPackage } from '../types/dnd';
import { EQUIPMENT_PACKAGES, loadEquipment } from '../services/dataService';

const EQUIPMENT_DATABASE = loadEquipment();

/**
 * Validate that all required equipment choices have been made
 */
export const validateEquipmentChoices = (choices: EquipmentChoice[]): boolean => {
  return choices.every(choice => choice.selected !== null);
};

/**
 * Get the indices of equipment choices that haven't been made yet
 */
export const getMissingEquipmentChoices = (choices: EquipmentChoice[]): number[] => {
  return choices
    .map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => choice.selected === null)
    .map(({ index }) => index + 1); // Return 1-based indices for display
};

/**
 * Calculate the total equipment value and weight from choices
 */
export const calculateEquipmentTotals = (
  choices: EquipmentChoice[]
): { totalValue: number; totalWeight: number; items: string[] } => {
  const items: string[] = [];
  let totalValue = 0;
  let totalWeight = 0;

  // Process equipment choices
  choices.forEach(choice => {
    if (choice.selected !== null && choice.options[choice.selected]) {
      choice.options[choice.selected].forEach(item => {
        items.push(item.name);
        const equipment = EQUIPMENT_DATABASE.find(eq => eq.name === item.name);
        if (equipment) {
          totalValue += equipment.cost.quantity * item.quantity;
          totalWeight += (equipment.weight || 0) * item.quantity;
        }
      });
    }
  });

  // Add background equipment (this would need to be implemented based on background data)
  // For now, return just the class equipment totals
  return { totalValue, totalWeight, items };
};

/**
 * Get the appropriate equipment package for a character level
 */
export const getEquipmentPackageForLevel = (level: number): EquipmentPackage | null => {
  // Find the package that matches the level, or use the first one as default
  return EQUIPMENT_PACKAGES.find(pkg => pkg.level === level) || EQUIPMENT_PACKAGES[0] || null;
};

/**
 * Check if an equipment item is part of an equipment package
 */
export const isEquipmentPackage = (itemName: string): boolean => {
  return EQUIPMENT_PACKAGES.some(pack => pack.name === itemName);
};

/**
 * Get equipment package details by name
 */
export const getEquipmentPackage = (packageName: string): EquipmentPackage | null => {
  return EQUIPMENT_PACKAGES.find(pack => pack.name === packageName) || null;
};

/**
 * Format equipment choice description for display
 */
export const formatEquipmentChoiceDescription = (choice: EquipmentChoice): string => {
  return choice.description;
};

/**
 * Get recommended equipment choice for a class (basic implementation)
 */
export const getRecommendedChoiceForClass = (choice: EquipmentChoice): number | null => {
  // This could be enhanced with class-specific recommendations
  // For now, return the first option as default
  return choice.options.length > 0 ? 0 : null;
};

/**
 * Check if equipment choice contains a package that should be displayed specially
 */
export const choiceContainsPackage = (choice: EquipmentChoice): boolean => {
  return choice.options.some(option =>
    option.some(item => isEquipmentPackage(item.name))
  );
};

/**
 * Get package from equipment choice option
 */
export const getPackageFromChoice = (choice: EquipmentChoice, optionIndex: number): EquipmentPackage | null => {
  if (choice.selected === null || !choice.options[optionIndex]) return null;

  const packOption = choice.options[optionIndex].find(item =>
    isEquipmentPackage(item.name)
  );

  return packOption ? getEquipmentPackage(packOption.name) : null;
};