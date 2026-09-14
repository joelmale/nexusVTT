import { Feat, CharacterCreationData, Edition } from '../types/dnd';
import { resolveSpeciesSlug } from '../services/dataService';
import { evaluatePredicate, evaluatePredicates } from '../rulesEngine/evaluators/predicates';
import type { Predicate } from '../rulesEngine/types/predicates';
import type { BaseFacts } from '../rulesEngine/types/baseFacts';
import type { Ability } from '../rulesEngine/types/common';

export interface FeatAvailability {
  isAvailable: boolean;
  reason?: string;
}

interface PredicateWithReason {
  predicate: Predicate;
  reason: string;
}

const abilityFromKey = (value: string): Ability | null => {
  switch (value.toUpperCase()) {
    case 'STR':
      return 'STR';
    case 'DEX':
      return 'DEX';
    case 'CON':
      return 'CON';
    case 'INT':
      return 'INT';
    case 'WIS':
      return 'WIS';
    case 'CHA':
      return 'CHA';
    default:
      return null;
  }
};

const hasSpeciesRequirement = (prerequisite: string): boolean => {
  const prereq = prerequisite.toLowerCase();
  return [
    'dwarf',
    'dragonborn',
    'elf',
    'halfling',
    'gnome',
    'tiefling',
    'half-orc',
    'half-elf',
    'human',
    'yuan-ti',
    'orc'
  ].some(keyword => prereq.includes(keyword));
};

const speciesPrerequisitePredicates = (
  prerequisite: string
): PredicateWithReason[] => {
  const prereq = prerequisite.toLowerCase();

  const makeSpeciesPredicate = (slugs: string[], reasonLabel?: string): PredicateWithReason => {
    if (slugs.length === 1) {
      return {
        predicate: { type: 'speciesIs', slug: slugs[0] },
        reason: `Requires ${reasonLabel || slugs[0]}`
      };
    }
    return {
      predicate: { type: 'or', predicates: slugs.map(slug => ({ type: 'speciesIs', slug })) },
      reason: `Requires ${reasonLabel || slugs.join(' or ')}`
    };
  };

  if (prereq.includes('elf or half-elf')) {
    return [makeSpeciesPredicate(['elf-2024', 'elf', 'half-elf'], 'Elf or Half-Elf')];
  }

  if (prereq.includes('half-elf, half-orc, or human')) {
    return [makeSpeciesPredicate(['half-elf', 'half-orc', 'human-2024', 'human'], 'Half-Elf, Half-Orc, or Human')];
  }

  if (prereq.includes('elf (drow)')) {
    return [makeSpeciesPredicate(['drow-lineage', 'drow'], 'Drow Elf')];
  }

  if (prereq.includes('elf (high)')) {
    return [makeSpeciesPredicate(['high-elf-lineage', 'high-elf'], 'High Elf')];
  }

  if (prereq.includes('elf')) {
    return [makeSpeciesPredicate(['elf-2024', 'elf', 'half-elf'], 'Elf')];
  }

  if (prereq.includes('halfling')) {
    return [makeSpeciesPredicate(['halfling'], 'Halfling')];
  }

  if (prereq.includes('dragonborn')) {
    return [makeSpeciesPredicate(['dragonborn-2024', 'dragonborn'], 'Dragonborn')];
  }

  if (prereq.includes('dwarf')) {
    return [makeSpeciesPredicate(['dwarf-2024', 'dwarf'], 'Dwarf')];
  }

  if (prereq.includes('gnome')) {
    return [makeSpeciesPredicate(['gnome-2024', 'gnome'], 'Gnome')];
  }

  if (prereq.includes('tiefling')) {
    return [makeSpeciesPredicate(['tiefling-2024', 'tiefling'], 'Tiefling')];
  }

  if (prereq.includes('half-orc')) {
    return [makeSpeciesPredicate(['half-orc'], 'Half-Orc')];
  }

  if (prereq.includes('orc')) {
    return [makeSpeciesPredicate(['orc', 'half-orc'], 'Orc or Half-Orc')];
  }

  if (prereq.includes('half-elf')) {
    return [makeSpeciesPredicate(['half-elf', 'elf', 'elf-2024'], 'Half-Elf')];
  }

  if (prereq.includes('human')) {
    return [makeSpeciesPredicate(['human-2024', 'human'], 'Human')];
  }

  if (prereq.includes('yuan-ti')) {
    return [makeSpeciesPredicate(['yuan-ti-pureblood'], 'Yuan-ti')];
  }

  return [];
};

/**
 * Build base facts from character creation data for rule-engine evaluation.
 */
const buildFactsFromCharacter = (character: Partial<CharacterCreationData>): BaseFacts => {
  const classSlug = (character.classSlug || '').toLowerCase();
  const level = character.level || 1;
  const legacySpecies = (character as { species?: string }).species;
  const legacyFeats = (character as { feats?: string[] }).feats;
  const speciesSlug = resolveSpeciesSlug(character.speciesSlug || legacySpecies || '');

  const abilities = (character.abilities || {}) as Record<string, number>;
  const normalizedAbilities = {
    STR: abilities.STR ?? 10,
    DEX: abilities.DEX ?? 10,
    CON: abilities.CON ?? 10,
    INT: abilities.INT ?? 10,
    WIS: abilities.WIS ?? 10,
    CHA: abilities.CHA ?? 10
  } as BaseFacts['abilities'];

  return {
    level,
    classSlug,
    classLevel: { [classSlug]: level },
    subclassSlug: undefined,
    speciesSlug,
    lineageSlug: character.selectedLineage,
    backgroundSlug: character.background || '',
    edition: character.edition || '2014',
    abilities: normalizedAbilities,
    choices: {},
    equippedArmor: undefined,
    equippedWeapons: [],
    equippedItems: [],
    conditions: [],
    tags: [],
    feats: character.selectedFeats || legacyFeats || []
  };
};

/**
 * Convert feat prerequisites into rule-engine predicates with human-readable reasons.
 */
const buildFeatPredicates = (feat: Feat): PredicateWithReason[] => {
  const predicates: PredicateWithReason[] = [];

  if (feat.prerequisites) {
    if (feat.prerequisites.level) {
      predicates.push({
        predicate: { type: 'levelAtLeast', value: feat.prerequisites.level },
        reason: `Requires level ${feat.prerequisites.level}+`
      });
    }

    if (feat.prerequisites.stats) {
      for (const [ability, required] of Object.entries(feat.prerequisites.stats)) {
        const normalized = abilityFromKey(ability);
        if (normalized) {
          predicates.push({
            predicate: { type: 'abilityAtLeast', ability: normalized, value: required },
            reason: `Requires ${ability.toUpperCase()} ${required}+`
          });
        }
      }
    }

    if (feat.prerequisites.spellcasting) {
      predicates.push({
        predicate: {
          type: 'or',
          predicates: [
            { type: 'hasTag', tag: 'spellcasting' },
            { type: 'classIs', slug: 'wizard' },
            { type: 'classIs', slug: 'sorcerer' },
            { type: 'classIs', slug: 'bard' },
            { type: 'classIs', slug: 'cleric' },
            { type: 'classIs', slug: 'druid' },
            { type: 'classIs', slug: 'paladin' },
            { type: 'classIs', slug: 'ranger' },
            { type: 'classIs', slug: 'warlock' },
            { type: 'classIs', slug: 'artificer' }
          ]
        },
        reason: 'Requires spellcasting ability'
      });
    }
  }

  if (feat.prerequisite) {
    const prerequisite = feat.prerequisite.toLowerCase();

    const abilityMatch = prerequisite.match(/(strength|dexterity|constitution|intelligence|wisdom|charisma)[^0-9]*(\d+)/i);
    if (abilityMatch) {
      const abilityName = abilityMatch[1].toUpperCase().slice(0, 3);
      const requiredScore = parseInt(abilityMatch[2]);
      const normalized = abilityFromKey(abilityName);
      if (normalized) {
        predicates.push({
          predicate: { type: 'abilityAtLeast', ability: normalized, value: requiredScore },
          reason: `Requires ${abilityName} ${requiredScore}+`
        });
      }
    }

    const levelMatch = prerequisite.match(/level\s+(\d+)/i);
    if (levelMatch) {
      const requiredLevel = parseInt(levelMatch[1]);
      predicates.push({
        predicate: { type: 'levelAtLeast', value: requiredLevel },
        reason: `Requires level ${requiredLevel}+`
      });
    }

    if (hasSpeciesRequirement(prerequisite)) {
      predicates.push(...speciesPrerequisitePredicates(prerequisite));
    }

    if (prerequisite.includes('spellcasting') || prerequisite.includes('the ability to cast')) {
      predicates.push({
        predicate: {
          type: 'or',
          predicates: [
            { type: 'hasTag', tag: 'spellcasting' },
            { type: 'classIs', slug: 'wizard' },
            { type: 'classIs', slug: 'sorcerer' },
            { type: 'classIs', slug: 'bard' },
            { type: 'classIs', slug: 'cleric' },
            { type: 'classIs', slug: 'druid' },
            { type: 'classIs', slug: 'paladin' },
            { type: 'classIs', slug: 'ranger' },
            { type: 'classIs', slug: 'warlock' },
            { type: 'classIs', slug: 'artificer' }
          ]
        },
        reason: 'Requires spellcasting ability'
      });
    }

    const classNames = ['fighter', 'rogue', 'wizard', 'cleric', 'barbarian', 'paladin', 'ranger', 'sorcerer', 'bard', 'druid', 'monk', 'warlock', 'artificer'];
    classNames.forEach(className => {
      if (prerequisite.includes(className)) {
        predicates.push({
          predicate: { type: 'classIs', slug: className },
          reason: `Requires ${className}`
        });
      }
    });
  }

  return predicates;
};

/**
 * Calculate how many feats a character can take based on their level and edition
 * Feats are available at levels 4, 8, 12, 16, 19 (every 4 levels starting at 4)
 * For 2024 Human, gain an additional feat at Level 1.
 */
export const calculateFeatAvailability = (
  data: CharacterCreationData | number,
  edition?: Edition,
  speciesSlug?: string
): number => {
  const level = typeof data === 'number' ? data : data.level;
  const effectiveEdition = typeof data === 'number' ? edition : data.edition;
  const effectiveSpecies = typeof data === 'number' ? speciesSlug : data.speciesSlug;
  let baseFeats = Math.floor((level - 1) / 4); // Standard feat progression from level 4

  // 2024 Human additional feat at Level 1
  if (effectiveEdition === '2024' && effectiveSpecies === 'human-2024') {
    baseFeats += 1; // 2024 Humans get an extra feat at Level 1
  }

  // Ensure minimum of 0 feats
  return Math.max(0, baseFeats);
};

/**
 * Check if a feat's prerequisites are met by the character
 * This is a basic implementation - can be enhanced with more complex prerequisite checking
 */
export const checkFeatPrerequisites = (feat: Feat, character: Partial<CharacterCreationData>): boolean => {
  return getFeatAvailability(feat, character).isAvailable;
};

/**
 * Return availability state and a human-readable reason if unavailable.
 */
export const getFeatAvailability = (
  feat: Feat,
  character: Partial<CharacterCreationData>
): FeatAvailability => {
  const facts = buildFactsFromCharacter(character);
  const predicatesWithReasons = buildFeatPredicates(feat);

  // Fast path: no predicates => available
  if (predicatesWithReasons.length === 0) {
    return { isAvailable: true };
  }

  for (const { predicate, reason } of predicatesWithReasons) {
    if (!evaluatePredicate(predicate, { facts, derived: {} })) {
      return { isAvailable: false, reason };
    }
  }

  const predicates = predicatesWithReasons.map(p => p.predicate);
  const isAvailable = evaluatePredicates(predicates, { facts, derived: {} });

  return { isAvailable };
};

/**
 * Filter feats based on character data and prerequisites
 */
export const filterAvailableFeats = (allFeats: Feat[], character: Partial<CharacterCreationData>): Feat[] => {
  return allFeats.filter(feat => checkFeatPrerequisites(feat, character));
};

/**
 * Check if a feat provides ability score increases
 */
export const featProvidesAbilityIncrease = (feat: Feat): boolean => {
  return !!feat.abilityScoreIncrease;
};

/**
 * Get the source information for a feat (SRD version, etc.)
 */
export const getFeatSourceInfo = (feat: Feat): string => {
  return `${feat.source} ${feat.year}`;
};

/**
 * Check if the character has reached the maximum number of feats for their level
 */
export const canSelectMoreFeats = (currentFeats: string[], data: CharacterCreationData | number): boolean => {
  const maxFeats = calculateFeatAvailability(data);
  return currentFeats.length < maxFeats;
};

/**
 * Get available feats for a character based on 2024 category rules
 */
export const getAvailableFeatsForCharacter = (
  allFeats: Feat[],
  character: Partial<CharacterCreationData>,
  context: 'asi' | 'fighting_style' | 'background' = 'asi'
): Feat[] => {
  const level = character.level || 1;
  const classSlug = character.classSlug || '';

  return allFeats.filter(feat => {
    // Check category availability based on context and level
    switch (context) {
      case 'background':
        return feat.category === 'origin';

      case 'fighting_style':
        // Only available to classes with Fighting Style feature
        if (!['fighter', 'paladin', 'ranger'].includes(classSlug)) return false;
        return feat.category === 'fighting_style';

      case 'asi':
      default:
        // General feats available at level 4+
        if (level < 4) return false;

        // Epic boons only at level 19+
        if (feat.category === 'epic_boon' && level < 19) return false;

        // Fighting styles not available in ASI (except via Fighting Initiate)
        if (feat.category === 'fighting_style') return false;

        // Origin feats are allowed but generally players pick general feats
        return ['general', 'origin'].includes(feat.category);
    }
  }).filter(feat => getFeatAvailability(feat, character).isAvailable);
};

/**
 * Enhanced prerequisite checking for 2024 system
 */
export const checkFeatPrerequisites2024 = (feat: Feat, character: Partial<CharacterCreationData>): boolean => {
  return getFeatAvailability(feat, character).isAvailable;
};

/**
 * Validate feat selection for a character
 */
export const validateFeatSelection = (selectedFeats: string[], allFeats: Feat[], character: Partial<CharacterCreationData>): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  const maxFeats = calculateFeatAvailability(
    character.level || 1,
    character.edition,
    character.speciesSlug
  );

  if (selectedFeats.length > maxFeats) {
    errors.push(`Too many feats selected. Maximum ${maxFeats} allowed at level ${character.level}.`);
  }

  // Check for duplicate feats
  const uniqueFeats = new Set(selectedFeats);
  if (uniqueFeats.size !== selectedFeats.length) {
    errors.push('Duplicate feats selected.');
  }

  // Check prerequisites for selected feats using 2024 system
  selectedFeats.forEach(featSlug => {
    const feat = allFeats.find(f => f.slug === featSlug);
    if (feat && !checkFeatPrerequisites2024(feat, character)) {
      errors.push(`Prerequisites not met for feat: ${feat.name}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};
