// Code Generator for Admin Panel - Generates TypeScript code from data
// Converts data structures back into TypeScript source code

import type {
  Weapon,
  Armor,
  Tool,
  Spell,
  Equipment,
  Feature,
  CharacterClass,
  CharacterRace,
  CharacterBackground,
  PersonalityData,
} from '@/types/character';

export interface CodeGenerationOptions {
  includeComments?: boolean;
  formatCode?: boolean;
  addTimestamps?: boolean;
}

export class CodeGenerator {
  private options: CodeGenerationOptions;

  constructor(options: CodeGenerationOptions = {}) {
    this.options = {
      includeComments: true,
      formatCode: true,
      addTimestamps: true,
      ...options,
    };
  }

  // Generate weapons array as TypeScript code
  generateWeaponsCode(weapons: Weapon[]): string {
    const header = this.generateHeader('Weapons Data');
    const data = this.generateArrayCode(weapons, 'Weapon');
    return `${header}${data}`;
  }

  // Generate armor array as TypeScript code
  generateArmorCode(armor: Armor[]): string {
    const header = this.generateHeader('Armor Data');
    const data = this.generateArrayCode(armor, 'Armor');
    return `${header}${data}`;
  }

  // Generate tools array as TypeScript code
  generateToolsCode(tools: Tool[]): string {
    const header = this.generateHeader('Tools Data');
    const data = this.generateArrayCode(tools, 'Tool');
    return `${header}${data}`;
  }

  // Generate spells array as TypeScript code
  generateSpellsCode(spells: Spell[]): string {
    const header = this.generateHeader('Spells Data');
    const data = this.generateArrayCode(spells, 'Spell');
    return `${header}${data}`;
  }

  // Generate equipment array as TypeScript code
  generateEquipmentCode(equipment: Equipment[]): string {
    const header = this.generateHeader('Equipment Data');
    const data = this.generateArrayCode(equipment, 'Equipment');
    return `${header}${data}`;
  }

  // Generate features array as TypeScript code
  generateFeaturesCode(features: Feature[]): string {
    const header = this.generateHeader('Features Data');
    const data = this.generateArrayCode(features, 'Feature');
    return `${header}${data}`;
  }

  // Generate personality data as TypeScript code
  generatePersonalityCode(personality: PersonalityData): string {
    const header = this.generateHeader('Personality Data');
    const data = this.generateObjectCode(personality, 'PersonalityData');
    return `${header}${data}`;
  }

  // Generate classes array as TypeScript code
  generateClassesCode(classes: CharacterClass[]): string {
    const header = this.generateHeader('Character Classes Data');
    const data = this.generateArrayCode(classes, 'CharacterClass');
    return `${header}${data}`;
  }

  // Generate races array as TypeScript code
  generateRacesCode(races: CharacterRace[]): string {
    const header = this.generateHeader('Character Races Data');
    const data = this.generateArrayCode(races, 'CharacterRace');
    return `${header}${data}`;
  }

  // Generate backgrounds array as TypeScript code
  generateBackgroundsCode(backgrounds: CharacterBackground[]): string {
    const header = this.generateHeader('Character Backgrounds Data');
    const data = this.generateArrayCode(backgrounds, 'CharacterBackground');
    return `${header}${data}`;
  }

  // Generate complete data file
  generateCompleteDataFile(data: {
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
  }): string {
    const imports = `import type {
  Weapon,
  Armor,
  Tool,
  Spell,
  Equipment,
  Feature,
  CharacterClass,
  CharacterRace,
  CharacterBackground,
  PersonalityData,
} from '@/types/character';

`;

    const exports = `// Export all data
export const WEAPONS: Weapon[] = ${this.generateArrayLiteral(data.weapons)};

export const ARMOR: Armor[] = ${this.generateArrayLiteral(data.armor)};

export const TOOLS: Tool[] = ${this.generateArrayLiteral(data.tools)};

export const SPELLS: Spell[] = ${this.generateArrayLiteral(data.spells)};

export const EQUIPMENT: Equipment[] = ${this.generateArrayLiteral(data.equipment)};

export const FEATURES: Feature[] = ${this.generateArrayLiteral(data.features)};

export const PERSONALITY_DATA: PersonalityData = ${this.generateObjectLiteral(data.personality)};

export const CHARACTER_CLASSES: CharacterClass[] = ${this.generateArrayLiteral(data.classes)};

export const CHARACTER_RACES: CharacterRace[] = ${this.generateArrayLiteral(data.races)};

export const CHARACTER_BACKGROUNDS: CharacterBackground[] = ${this.generateArrayLiteral(data.backgrounds)};
`;

    return `${this.generateHeader('Complete Character Generation Data')}${imports}${exports}`;
  }

  private generateHeader(title: string): string {
    const timestamp = this.options.addTimestamps
      ? `// Generated on: ${new Date().toISOString()}\n`
      : '';
    const comment = this.options.includeComments
      ? `// ${title}\n${timestamp}// Auto-generated by Admin Panel - DO NOT EDIT MANUALLY\n\n`
      : '';
    return comment;
  }

  private generateArrayCode(items: unknown[], typeName: string): string {
    const literal = this.generateArrayLiteral(items);
    return `export const ${typeName.toUpperCase()}S: ${typeName}[] = ${literal};\n\n`;
  }

  private generateObjectCode(obj: unknown, typeName: string): string {
    const literal = this.generateObjectLiteral(obj);
    return `export const ${typeName.toUpperCase()}_DATA: ${typeName} = ${literal};\n\n`;
  }

  private generateArrayLiteral(items: unknown[]): string {
    if (items.length === 0) return '[]';

    const formattedItems = items.map((item) =>
      this.generateObjectLiteral(item, 2),
    );
    return `[\n${formattedItems.join(',\n')}\n]`;
  }

  private generateObjectLiteral(obj: unknown, indent: number = 0): string {
    const indentStr = ' '.repeat(indent);

    if (obj === null || obj === undefined) {
      return 'null';
    }

    if (typeof obj === 'string') {
      return `'${obj.replace(/'/g, "\\'")}'`;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';

      const items = obj.map((item) => {
        if (typeof item === 'object') {
          return this.generateObjectLiteral(item, indent + 2);
        }
        return this.generateObjectLiteral(item);
      });

      return `[\n${indentStr}  ${items.join(`,\n${indentStr}  `)}\n${indentStr}]`;
    }

    if (typeof obj === 'object') {
      const entries = Object.entries(obj)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => {
          const formattedValue =
            typeof value === 'object'
              ? this.generateObjectLiteral(value, indent + 2)
              : this.generateObjectLiteral(value);
          return `${key}: ${formattedValue}`;
        });

      if (entries.length === 0) return '{}';

      return `{\n${indentStr}  ${entries.join(`,\n${indentStr}  `)}\n${indentStr}}`;
    }

    return String(obj);
  }
}

// Singleton instance
let codeGeneratorInstance: CodeGenerator | null = null;

export function getCodeGenerator(
  options?: CodeGenerationOptions,
): CodeGenerator {
  if (!codeGeneratorInstance) {
    codeGeneratorInstance = new CodeGenerator(options);
  }
  return codeGeneratorInstance;
}
