// Data Manager for Admin Panel - Centralized data access and modification
// Provides CRUD operations for all character generation data sources

import type {
  Weapon,
  Armor,
  Tool,
  Spell,
  Equipment,
  Feature,
  PersonalityData,
  CharacterClass,
  CharacterRace,
  CharacterBackground,
} from '@/types/character';
import {
  PLACEHOLDER_WEAPONS,
  PLACEHOLDER_ARMOR,
  PLACEHOLDER_TOOLS,
  PLACEHOLDER_SPELLS,
  PLACEHOLDER_EQUIPMENT,
  PLACEHOLDER_FEATURES,
  PLACEHOLDER_PERSONALITY,
  PLACEHOLDER_CLASSES,
  PLACEHOLDER_RACES,
  PLACEHOLDER_BACKGROUNDS,
} from '@/data/character/defaultData';
import { getCodeGenerator } from './codeGenerator';
import { getFileSystemManager, getDataFilename } from './fileSystem';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface AllData {
  weapons: Weapon[];
  armor: Armor[];
  tools: Tool[];
  spells: Spell[];
  equipment: Equipment[];
  features: Feature[];
  personality: PersonalityData;
  classes: CharacterClass[];
  races: CharacterRace[];
  backgrounds: CharacterBackground[];
}

export interface DataManager {
  // Core data access
  getWeapons(): Weapon[];
  getArmor(): Armor[];
  getTools(): Tool[];
  getSpells(): Spell[];
  getEquipment(): Equipment[];
  getFeatures(): Feature[];
  getPersonalityData(): PersonalityData;
  getClasses(): CharacterClass[];
  getRaces(): CharacterRace[];
  getBackgrounds(): CharacterBackground[];

  // Modification methods
  addWeapon(weapon: Omit<Weapon, 'id'>): Weapon;
  updateWeapon(id: string, updates: Partial<Weapon>): Weapon;
  deleteWeapon(id: string): void;

  addArmor(armor: Omit<Armor, 'id'>): Armor;
  updateArmor(id: string, updates: Partial<Armor>): Armor;
  deleteArmor(id: string): void;

  addTool(tool: Omit<Tool, 'id'>): Tool;
  updateTool(id: string, updates: Partial<Tool>): Tool;
  deleteTool(id: string): void;

  // Bulk operations
  importData(jsonData: string): ValidationResult;
  exportData(): string;

  // Persistence (Phase 3)
  saveToCode(): Promise<{ success: boolean; message: string; files: string[] }>;
  loadFromCode(): Promise<{ success: boolean; message: string }>;
  exportDataFile(): string;

  // Validation
  validateWeapon(weapon: Weapon): ValidationResult;
  validateArmor(armor: Armor): ValidationResult;
  validateAllData(): ValidationResult[];
}

class DataManagerImpl implements DataManager {
  private weapons: Weapon[] = [...PLACEHOLDER_WEAPONS];
  private armor: Armor[] = [...PLACEHOLDER_ARMOR];
  private tools: Tool[] = [...PLACEHOLDER_TOOLS];
  private spells: Spell[] = [...PLACEHOLDER_SPELLS];
  private equipment: Equipment[] = [...PLACEHOLDER_EQUIPMENT];
  private features: Feature[] = [...PLACEHOLDER_FEATURES];
  private personality: PersonalityData = { ...PLACEHOLDER_PERSONALITY };
  private classes: CharacterClass[] = [...PLACEHOLDER_CLASSES];
  private races: CharacterRace[] = [...PLACEHOLDER_RACES];
  private backgrounds: CharacterBackground[] = [...PLACEHOLDER_BACKGROUNDS];

  // Core data access
  getWeapons(): Weapon[] {
    return [...this.weapons];
  }
  getArmor(): Armor[] {
    return [...this.armor];
  }
  getTools(): Tool[] {
    return [...this.tools];
  }
  getSpells(): Spell[] {
    return [...this.spells];
  }
  getEquipment(): Equipment[] {
    return [...this.equipment];
  }
  getFeatures(): Feature[] {
    return [...this.features];
  }
  getPersonalityData(): PersonalityData {
    return { ...this.personality };
  }
  getClasses(): CharacterClass[] {
    return [...this.classes];
  }
  getRaces(): CharacterRace[] {
    return [...this.races];
  }
  getBackgrounds(): CharacterBackground[] {
    return [...this.backgrounds];
  }

  // Weapon CRUD
  addWeapon(weapon: Omit<Weapon, 'id'>): Weapon {
    const newWeapon: Weapon = {
      ...weapon,
      id: crypto.randomUUID(),
    };
    this.weapons.push(newWeapon);
    return newWeapon;
  }

  updateWeapon(id: string, updates: Partial<Weapon>): Weapon {
    const index = this.weapons.findIndex((w) => w.id === id);
    if (index === -1) throw new Error('Weapon not found');

    this.weapons[index] = { ...this.weapons[index], ...updates };
    return this.weapons[index];
  }

  deleteWeapon(id: string): void {
    this.weapons = this.weapons.filter((w) => w.id !== id);
  }

  // Armor CRUD
  addArmor(armor: Omit<Armor, 'id'>): Armor {
    const newArmor: Armor = {
      ...armor,
      id: crypto.randomUUID(),
    };
    this.armor.push(newArmor);
    return newArmor;
  }

  updateArmor(id: string, updates: Partial<Armor>): Armor {
    const index = this.armor.findIndex((a) => a.id === id);
    if (index === -1) throw new Error('Armor not found');

    this.armor[index] = { ...this.armor[index], ...updates };
    return this.armor[index];
  }

  deleteArmor(id: string): void {
    this.armor = this.armor.filter((a) => a.id !== id);
  }

  // Tool CRUD
  addTool(tool: Omit<Tool, 'id'>): Tool {
    const newTool: Tool = {
      ...tool,
      id: crypto.randomUUID(),
    };
    this.tools.push(newTool);
    return newTool;
  }

  updateTool(id: string, updates: Partial<Tool>): Tool {
    const index = this.tools.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('Tool not found');

    this.tools[index] = { ...this.tools[index], ...updates };
    return this.tools[index];
  }

  deleteTool(id: string): void {
    this.tools = this.tools.filter((t) => t.id !== id);
  }

  // Bulk operations
  importData(jsonData: string): ValidationResult {
    try {
      const data: Partial<AllData> = JSON.parse(jsonData);
      const errors: string[] = [];

      // Validate and import each data type
      if (data.weapons) {
        const weaponErrors = data.weapons
          .map((w) => this.validateWeapon(w))
          .filter((r) => !r.isValid);
        if (weaponErrors.length > 0) {
          errors.push(`${weaponErrors.length} invalid weapons`);
        } else {
          this.weapons = data.weapons;
        }
      }

      if (data.armor) {
        const armorErrors = data.armor
          .map((a) => this.validateArmor(a))
          .filter((r) => !r.isValid);
        if (armorErrors.length > 0) {
          errors.push(`${armorErrors.length} invalid armor items`);
        } else {
          this.armor = data.armor;
        }
      }

      // Add validation for other data types...

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch {
      return {
        isValid: false,
        errors: ['Invalid JSON format'],
      };
    }
  }

  exportData(): string {
    const allData: AllData = {
      weapons: this.weapons,
      armor: this.armor,
      tools: this.tools,
      spells: this.spells,
      equipment: this.equipment,
      features: this.features,
      personality: this.personality,
      classes: this.classes,
      races: this.races,
      backgrounds: this.backgrounds,
    };

    return JSON.stringify(allData, null, 2);
  }

  // Persistence - Phase 3 implementation
  async saveToCode(): Promise<{
    success: boolean;
    message: string;
    files: string[];
  }> {
    try {
      const codeGenerator = getCodeGenerator();
      const fileSystem = getFileSystemManager();
      const savedFiles: string[] = [];

      // Generate and save each data type
      if (this.weapons.length > 0) {
        const code = codeGenerator.generateWeaponsCode(this.weapons);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('weapons'),
        );
        if (result.success) savedFiles.push(getDataFilename('weapons'));
        else
          return {
            success: false,
            message: `Failed to save weapons: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.armor.length > 0) {
        const code = codeGenerator.generateArmorCode(this.armor);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('armor'),
        );
        if (result.success) savedFiles.push(getDataFilename('armor'));
        else
          return {
            success: false,
            message: `Failed to save armor: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.tools.length > 0) {
        const code = codeGenerator.generateToolsCode(this.tools);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('tools'),
        );
        if (result.success) savedFiles.push(getDataFilename('tools'));
        else
          return {
            success: false,
            message: `Failed to save tools: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.spells.length > 0) {
        const code = codeGenerator.generateSpellsCode(this.spells);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('spells'),
        );
        if (result.success) savedFiles.push(getDataFilename('spells'));
        else
          return {
            success: false,
            message: `Failed to save spells: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.equipment.length > 0) {
        const code = codeGenerator.generateEquipmentCode(this.equipment);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('equipment'),
        );
        if (result.success) savedFiles.push(getDataFilename('equipment'));
        else
          return {
            success: false,
            message: `Failed to save equipment: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.features.length > 0) {
        const code = codeGenerator.generateFeaturesCode(this.features);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('features'),
        );
        if (result.success) savedFiles.push(getDataFilename('features'));
        else
          return {
            success: false,
            message: `Failed to save features: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.classes.length > 0) {
        const code = codeGenerator.generateClassesCode(this.classes);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('classes'),
        );
        if (result.success) savedFiles.push(getDataFilename('classes'));
        else
          return {
            success: false,
            message: `Failed to save classes: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.races.length > 0) {
        const code = codeGenerator.generateRacesCode(this.races);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('races'),
        );
        if (result.success) savedFiles.push(getDataFilename('races'));
        else
          return {
            success: false,
            message: `Failed to save races: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.backgrounds.length > 0) {
        const code = codeGenerator.generateBackgroundsCode(this.backgrounds);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('backgrounds'),
        );
        if (result.success) savedFiles.push(getDataFilename('backgrounds'));
        else
          return {
            success: false,
            message: `Failed to save backgrounds: ${result.message}`,
            files: savedFiles,
          };
      }

      // Save personality data separately
      const personalityCode = codeGenerator.generatePersonalityCode(
        this.personality,
      );
      const personalityFilename = getDataFilename('personality');
      const personalityResult = await fileSystem.saveFile(
        personalityCode,
        personalityFilename,
      );

      if (personalityResult.success) {
        savedFiles.push(personalityFilename);
      }

      // Clean up old backups
      fileSystem.clearOldBackups(20);

      return {
        success: true,
        message: `Successfully saved ${savedFiles.length} data files`,
        files: savedFiles,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to save code: ${error}`,
        files: [],
      };
    }
  }

  async loadFromCode(): Promise<{ success: boolean; message: string }> {
    // Note: Loading from code files is complex in browser environment
    // This would typically require a build process or backend API
    return {
      success: false,
      message:
        'Loading from code files requires a build process. Please restart the application to load updated data.',
    };
  }

  exportDataFile(): string {
    const codeGenerator = getCodeGenerator();
    const allData = {
      weapons: this.weapons,
      armor: this.armor,
      tools: this.tools,
      spells: this.spells,
      equipment: this.equipment,
      features: this.features,
      personality: this.personality,
      classes: this.classes,
      races: this.races,
      backgrounds: this.backgrounds,
    };

    return codeGenerator.generateCompleteDataFile(allData);
  }

  // Validation
  validateWeapon(weapon: Weapon): ValidationResult {
    const errors: string[] = [];

    if (!weapon.name?.trim()) errors.push('Name is required');
    if (!weapon.type) errors.push('Type is required');
    if (!weapon.damage) errors.push('Damage is required');

    // Validate damage format (e.g., "1d8", "2d6+2")
    const damagePattern = /^\d+d\d+(\+\d+)?$/;
    if (weapon.damage && !damagePattern.test(weapon.damage)) {
      errors.push('Damage must be in format like "1d8" or "2d6+2"');
    }

    return { isValid: errors.length === 0, errors };
  }

  validateArmor(armor: Armor): ValidationResult {
    const errors: string[] = [];

    if (!armor.name?.trim()) errors.push('Name is required');
    if (!armor.type) errors.push('Type is required');
    if (armor.ac === undefined || armor.ac < 10)
      errors.push('AC must be 10 or higher');

    return { isValid: errors.length === 0, errors };
  }

  validateAllData(): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Validate all weapons
    this.weapons.forEach((weapon) => {
      results.push(this.validateWeapon(weapon));
    });

    // Validate all armor
    this.armor.forEach((armor) => {
      results.push(this.validateArmor(armor));
    });

    // TODO: Add validation for other data types

    return results;
  }
}

// Singleton instance
let dataManagerInstance: DataManager | null = null;

export function getDataManager(): DataManager {
  if (!dataManagerInstance) {
    dataManagerInstance = new DataManagerImpl();
  }
  return dataManagerInstance;
}

export function resetDataManager(): void {
  dataManagerInstance = null;
}
