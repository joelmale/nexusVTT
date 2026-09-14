import { ContentParser } from './types';
import { SpellParser } from './spell-parser';
import { MonsterParser } from './monster-parser';
import { EquipmentParser } from './equipment-parser';
import { GenericParser } from './generic-parser';

export * from './types';

/**
 * Map of content types to their parsers
 */
const PARSER_MAP: Record<string, () => ContentParser> = {
  // Specialized parsers
  'spells': () => new SpellParser(),
  'monsters': () => new MonsterParser(),
  'equipment': () => new EquipmentParser(false),
  'magic-items': () => new EquipmentParser(true),

  // Generic parsers with specific types
  'ability-scores': () => new GenericParser('ability-scores', 'ability_score'),
  'skills': () => new GenericParser('skills', 'skill'),
  'proficiencies': () => new GenericParser('proficiencies', 'proficiency'),
  'languages': () => new GenericParser('languages', 'language'),
  'classes': () => new GenericParser('classes', 'class_info'),
  'subclasses': () => new GenericParser('subclasses', 'subclass'),
  'races': () => new GenericParser('races', 'race'),
  'subraces': () => new GenericParser('subraces', 'subrace'),
  'backgrounds': () => new GenericParser('backgrounds', 'background'),
  'feats': () => new GenericParser('feats', 'feat'),
  'features': () => new GenericParser('features', 'class_feature'),
  'traits': () => new GenericParser('traits', 'trait'),
  'conditions': () => new GenericParser('conditions', 'condition'),
  'damage-types': () => new GenericParser('damage-types', 'damage_type'),
  'magic-schools': () => new GenericParser('magic-schools', 'magic_school'),
  'weapon-properties': () => new GenericParser('weapon-properties', 'weapon_property'),
  'alignments': () => new GenericParser('alignments', 'alignment'),
  'equipment-categories': () => new GenericParser('equipment-categories', 'equipment_category'),
  'rules': () => new GenericParser('rules', 'rule'),
  'rule-sections': () => new GenericParser('rule-sections', 'rule'),
};

/**
 * Get a parser for a specific content type
 */
export function getParser(contentType: string): ContentParser {
  const parserFactory = PARSER_MAP[contentType];
  if (!parserFactory) {
    console.warn(`No specialized parser for ${contentType}, using generic parser`);
    return new GenericParser(contentType, 'other');
  }
  return parserFactory();
}

/**
 * Get all supported content types
 */
export function getSupportedContentTypes(): string[] {
  return Object.keys(PARSER_MAP);
}
