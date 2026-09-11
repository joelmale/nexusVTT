// SRD Data Loader and Transformer
// Transforms 5e SRD JSON format to our app's format
// Supports both 2014 and 2024 editions with 'year' field to distinguish

import srdSpellsMerged from '../data/srd/5e-SRD-Spells-Merged.json';
import srdRaces2014 from '../data/srd/2014/5e-SRD-Races.json';
import srdClasses2014 from '../data/srd/2014/5e-SRD-Classes.json';
import srdClasses2024 from '../data/srd/2024/5e-SRD-Classes.json';
import srdEquipment from '../data/equipment.json';
// Sprint 5: Features, Subclasses, and Feats
import srdFeatures2014 from '../data/srd/2014/5e-SRD-Features.json';
import srdSubclasses2014 from '../data/srd/2014/5e-SRD-Subclasses.json';
import srdSubclasses2018 from '../data/srd/2018/5e-SRD-Subclasses.json';
import srdSubclasses2020 from '../data/srd/2020/5e-SRD-Subclasses.json';
import srdSubclasses2020egtw from '../data/srd/2020-egtw/5e-SRD-Subclasses.json';
import srdFeats2014 from '../data/srd/2014/5e-SRD-Feats.json';
import srdMonsters2014 from '../data/srd/2014/5e-SRD-Monsters.json';
import featsData from '../data/feats.json';
import alignmentsData from '../data/alignments.json';
import backgroundsData from '../data/backgrounds.json';
import equipmentPackagesData from '../data/equipmentPackages.json';
import speciesData from '../data/species.json';
import { quickStartEquipmentPresets } from '../data/quickStartEquipment';
import startingWealthData from '../data/startingWealth.json';
import newPlayerShopData from '../data/newPlayerShop.json';
import { ClassWealthRule, ShopItem, QuickStartPresets } from '../types/equipment';
import fightingStylesData from '../data/fightingStyles.json';
import speciesCategoriesData from '../data/speciesCategories.json';
import classCategoriesData from '../data/classCategories.json';
import enhancedClassData from '../data/enhancedClassData.json';
import enhancedSpeciesData from '../data/enhancedSpeciesData.json';
import gameConstantsData from '../data/gameConstants.json';
import levelConstantsData from '../data/levelConstants.json';
import spellcastingTypesData from '../data/spellcastingTypes.json';
import speciesLanguagesData from '../data/speciesLanguages.json';
import backgroundDefaultsData from '../data/backgroundDefaults.json';
import combatActionsData from '../data/combatActions.json';
import { generateName } from '../utils/nameGenerator';
import { log } from '../utils/logger';
import { AbilityName, Species, Class, Equipment, Feature, Subclass, Feat, SpeciesCategory, ClassCategory, EquipmentPackage, EquipmentChoice, EquipmentItem, EquippedItem, SpellcastingType, SkillName, Monster, MonsterType, Edition, Background } from '../types/dnd';
import { Level1Feature } from '../types/widgets';
import { getSelectableLanguages } from '../data/languages';

// Local type definitions for dataService
interface Alignment {
  index: string;
  name: string;
  abbreviation: string;
  category: string;
  examples: string[];
  short_desc: string;
  long_desc: string;
}

// Background type is defined in shared DnD types.

export interface CombatAction {
  slug: string;
  name: string;
  summary: string;
  description: string;
  actionEconomy: 'action' | 'bonus_action' | 'reaction' | 'free' | 'movement' | 'special' | 'varies';
  rollType: 'skill' | 'attack' | 'healing' | 'damage' | 'none' | 'conditional';
  ability?: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
  skill?: string;
  contest?: string;
  category: 'special-attack' | 'tactical' | 'class-feature' | 'combat' | 'spellcasting' | 'utility' | 'movement';
  class?: string;
  subclass?: string;
  minLevel?: number;
  usageType?: 'limited' | 'ki' | 'spell-slot' | 'pool' | 'spell';
  usesPerLevel?: Record<string, number | string>;
  rechargeType?: 'short' | 'long';
  notation?: string;
  damageByLevel?: Record<string, string>;
  cost?: string;
}

interface CombatActionsData {
  metadata: {
    system: string;
    version: string;
    source: string;
  };
  standardActions: CombatAction[];
  bonusActions: CombatAction[];
  reactions: CombatAction[];
  movement: CombatAction[];
  classFeatureActions: CombatAction[];
}




interface FightingStyle {
  slug: string;
  name: string;
  description: string;
  prerequisite: string;
}

// --- App Type Definitions ---
export interface AppSubclass {
  slug: string;
  name: string;
  class: string;
  subclassFlavor: string;
  desc?: string[];
}

// --- SRD Type Definitions ---
interface SRDSpell {
  index?: string;
  name: string;
  desc?: string[]; // Raw SRD format
  description?: string; // Already transformed format
  higher_level?: string[];
  higherLevelSlot?: string;
  range: string;
  components: string[];
  material?: string;
  ritual: boolean;
  duration: string;
  concentration: boolean;
  casting_time?: string;
  actionType?: string;
  level: number;
  school: string | { index: string; name: string };
  classes: string[] | Array<{ index: string; name: string }>;
  damage?: {
    damage_type?: { index: string; name: string };
  };
  dc?: {
    dc_type: { index: string; name: string };
  };
  source: '2014' | '2024';
}

interface SRDRace {
  index: string;
  name: string;
  speed: number;
  ability_bonuses: Array<{ 
    ability_score: { index: string; name: string };
    bonus: number;
  }>;
  traits: Array<{ index: string; name: string }>;
  subraces?: Array<{ index: string; name: string }>;
}

interface SRDClass {
  index: string;
  name: string;
  hit_die: number;
  proficiency_choices: Array<{
    desc?: string;
    choose: number;
    type: string;
    from: { options: Array<{ item: { index: string; name: string } }> };
  }>;
  proficiencies: Array<{ index: string; name: string }>;
  saving_throws: Array<{ index: string; name: string }>;
  starting_equipment?: Array<{
    equipment: { index: string; name: string; url: string };
    quantity: number;
  }>;
  starting_equipment_options?: Array<{
    desc: string;
    choose: number;
    type: string;
    from: {
      option_set_type: string;
      options: Array<{
        option_type?: string;
        equipment?: { index: string; name: string; url: string };
        equipment_category?: { index: string; name: string };
      }>;
    };
  }>;
  spellcasting?: {
    level?: number;
    spellcasting_ability: { index: string; name: string };
    info?: Array<{
      name: string;
      desc: string[];
    }>;
  };
  level_1_features?: Array<{
    id: string;
    name: string;
    desc: string;
    widget_type: string;
    widget_config: unknown;
  }>;
}

// Equipment SRD Type Definitions


interface SRDEquipment {
  index: string;
  name: string;
  equipment_categories: Array<{ index: string; name: string }>;
  cost: { quantity: number; unit: string };
  weight: number;
  description?: string;
  url: string;

  // Weapon fields
  damage?: {
    damage_dice: string;
    damage_type: { index: string; name: string };
  };
  range?: { normal: number; long?: number };
  properties?: Array<{ index: string; name: string }>;
  two_handed_damage?: {
    damage_dice: string;
    damage_type: { index: string; name: string };
  };
  mastery?: { index: string; name: string };

  // Armor fields
  armor_category?: string;
  armor_class?: { base: number; dex_bonus: boolean; max_bonus?: number };
  str_minimum?: number;
  stealth_disadvantage?: boolean;
  don_time?: string;
  doff_time?: string;

  // Gear fields
  gear_category?: string;
  tool_category?: string;
  ability?: { index: string; name: string };
  craft?: Array<{ index: string; name: string }>;
  contents?: Array<{ item: { index: string; name: string }; quantity: number }>;
  storage?: { index: string; name: string };
  quantity?: number;
}



// --- App Type Definitions (matching App.tsx) ---
type SchoolName = 'Abjuration' | 'Conjuration' | 'Divination' | 'Enchantment' | 'Evocation' | 'Illusion' | 'Necromancy' | 'Transmutation';

export interface AppSpell {
  slug: string;
  name: string;
  level: number;
  school: SchoolName;
  castingTime: string;
  range: string;
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialDescription?: string;
  };
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  atHigherLevels?: string;
  damageType?: string;
  saveType?: AbilityName;
  classes: string[];
  source: '2014' | '2024'; // Source edition
  year: number; // Edition year (2014 or 2024)
}

// --- Transformation Functions ---

function capitalizeSchool(school: string): SchoolName {
  return (school.charAt(0).toUpperCase() + school.slice(1)) as SchoolName;
}

function mapAbilityScore(srdAbility: string): AbilityName {
  const mapping: Record<string, AbilityName> = {
    'str': 'STR',
    'dex': 'DEX',
    'con': 'CON',
    'int': 'INT',
    'wis': 'WIS',
    'cha': 'CHA'
  };
  return mapping[srdAbility.toLowerCase()] || 'STR';
}

export function transformSpell(srdSpell: SRDSpell): AppSpell {
  // Handle different school formats (2014 nested vs 2024 flat)
  const schoolName = typeof srdSpell.school === 'string'
    ? srdSpell.school
    : srdSpell.school.name;

  // Handle different casting time formats
  const castingTime = srdSpell.casting_time || srdSpell.actionType || '1 action';

  // Handle different higher level formats
  const atHigherLevels = srdSpell.higher_level?.join('\n\n') || srdSpell.higherLevelSlot;

  // Handle different class formats
  const classes = Array.isArray(srdSpell.classes) && typeof srdSpell.classes[0] === 'object' && srdSpell.classes[0]?.index
    ? (srdSpell.classes as Array<{ index: string }>).map(c => c.index) // 2014 nested format
    : srdSpell.classes as string[]; // 2024 flat format

  return {
    slug: srdSpell.index || srdSpell.name.toLowerCase().replace(/\s+/g, '-'),
    name: srdSpell.name,
    level: srdSpell.level,
    school: capitalizeSchool(schoolName),
    castingTime,
    range: srdSpell.range,
    components: {
      verbal: srdSpell.components.some((c: string) => c.toLowerCase() === 'v'),
      somatic: srdSpell.components.some((c: string) => c.toLowerCase() === 's'),
      material: srdSpell.components.some((c: string) => c.toLowerCase() === 'm'),
      materialDescription: srdSpell.material,
    },
    duration: srdSpell.duration,
    concentration: srdSpell.concentration,
    ritual: srdSpell.ritual,
    description: srdSpell.description || (srdSpell.desc ? srdSpell.desc.join('\n\n') : ''),
    atHigherLevels,
    damageType: srdSpell.damage?.damage_type?.name,
    saveType: srdSpell.dc ? mapAbilityScore(srdSpell.dc.dc_type.index) : undefined,
    classes,
    source: srdSpell.source,
    year: srdSpell.source === '2024' ? 2024 : 2014,
  };
}

export function transformSpecies(srdSpecies: SRDRace, year: number = 2014): Species {
  const edition: Edition = year === 2024 ? '2024' : '2014';
  const abilityBonuses: Partial<Record<AbilityName, number>> = {};
  srdSpecies.ability_bonuses.forEach(bonus => {
    const ability = mapAbilityScore(bonus.ability_score.index);
    abilityBonuses[ability] = bonus.bonus;
  });

   // Handle human variants specially
   let variants = undefined;
   let defaultVariant = undefined;
   let finalAbilityBonuses = abilityBonuses;
   let finalSpeciesTraits = srdSpecies.traits.map(t => t.name);

   if (srdSpecies.index === 'human') {
     // Define human variants
     variants = [
       {
         slug: 'standard',
         name: 'Standard Human',
         description: 'The classic human from the Basic Rules - +1 to all ability scores for broad versatility.',
         ability_bonuses: { STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 },
         species_traits: [],
         features: []
       },
       {
         slug: 'variant',
         name: 'Variant Human',
         description: 'The specialist human - +1 to two abilities, one skill proficiency, and one feat for focused power.',
         ability_bonuses: {},
         species_traits: ['Variant Skills', 'Variant Feat'],
         features: []
       }
     ];
     defaultVariant = 'variant';

     // Clear base ability bonuses and traits for human (handled by variants)
     finalAbilityBonuses = {};
     finalSpeciesTraits = [];
   }

   return {
     slug: srdSpecies.index,
     name: srdSpecies.name,
     edition,
     source: `SRD ${year}`,
     speed: srdSpecies.speed,
     ability_bonuses: finalAbilityBonuses,
     species_traits: finalSpeciesTraits,
     description: `${srdSpecies.name} from the System Reference Document.`,
     typicalRoles: [], // SRD doesn't include this, would need to be added manually
     variants,
     defaultVariant
   };
}

export function transformClass(srdClass: SRDClass, year: number = 2014): Class {
  // Determine edition based on year
  const edition: Edition = year === 2024 ? '2024' : '2014';

  // Separate skill and musical instrument proficiencies from proficiency_choices
  const skillChoices = (srdClass.proficiency_choices || [])
    .filter(choice => choice && choice.type === 'proficiencies' && !choice.desc?.toLowerCase().includes('musical instrument'));

  const instrumentChoices = (srdClass.proficiency_choices || [])
    .filter(choice => choice && choice.type === 'proficiencies' && choice.desc?.toLowerCase().includes('musical instrument'));

  // Extract skill proficiencies
  const skillProficiencies = skillChoices
    .flatMap(choice =>
      (choice.from?.options || [])
        .filter(opt => opt && opt.item && opt.item.name)
        .map(opt => opt.item.name.replace(/^Skill:\s*/, ''))
    );

  const numSkillChoices = skillChoices
    .reduce((sum, choice) => sum + (choice.choose || 0), 0);

  // Extract musical instrument proficiencies
  const musicalInstrumentProficiencies = instrumentChoices
    .flatMap(choice =>
      (choice.from?.options || [])
        .filter(opt => opt && opt.item && opt.item.name)
        .map(opt => opt.item.name)
    );

  const numInstrumentChoices = instrumentChoices
    .reduce((sum, choice) => sum + (choice.choose || 0), 0);

  // Extract core proficiencies (armor, weapons, tools)
  const armorProficiencies: string[] = [];
  const weaponProficiencies: string[] = [];
  const toolProficiencies: string[] = [];

  (srdClass.proficiencies || []).forEach(prof => {
    const name = prof.name;
    const lower = name.toLowerCase();

    if (lower.includes('saving throw')) {
      return; // Skip saving throws
    }

    if (lower.includes('armor') || lower.includes('shield')) {
      armorProficiencies.push(name);
      return;
    }

    if (
      lower.includes('tool') ||
      lower.includes('kit') ||
      lower.includes('vehicle') ||
      lower.includes('instrument')
    ) {
      toolProficiencies.push(name);
      return;
    }

    weaponProficiencies.push(name);
  });

  // Transform spellcasting data if present
  let spellcasting: Class['spellcasting'] = undefined;
  if (srdClass.spellcasting) {
    const ability = mapAbilityScore(srdClass.spellcasting.spellcasting_ability.index) as 'INT' | 'WIS' | 'CHA';

    // Default spell slots for full casters (will need to be adjusted for half-casters)
    const defaultSpellSlots = [0, 2, 3, 4, 4, 4, 4, 4, 4, 4]; // Level 1-9 slots at char level 1

    // Define cantrips, spells known, and type by class
    let cantripsKnown = 0;
    let spellsKnownOrPrepared = 0;
    let type: SpellcastingType = 'known';

    // Set defaults based on class (these are level 1 values)
    switch (srdClass.index) {
      case 'wizard':
        cantripsKnown = 3;
        spellsKnownOrPrepared = 6;
        type = 'wizard';
        break;
      case 'sorcerer':
        cantripsKnown = 4;
        spellsKnownOrPrepared = 2;
        type = 'known';
        break;
      case 'bard':
        cantripsKnown = 2;
        spellsKnownOrPrepared = 4;
        type = 'known';
        break;
      case 'warlock':
        cantripsKnown = 2;
        spellsKnownOrPrepared = 2;
        type = 'known';
        break;
      case 'cleric':
        cantripsKnown = 3;
        spellsKnownOrPrepared = 2;
        type = 'prepared';
        break;
      case 'druid':
        cantripsKnown = 2; // Base count, +1 for Magician Primal Order applied in wizard
        spellsKnownOrPrepared = 0; // Calculated dynamically: WIS modifier + level
        type = 'prepared';
        break;
      case 'paladin':
        cantripsKnown = 0;
        spellsKnownOrPrepared = 0;
        type = 'prepared';
        break;
      case 'ranger':
        cantripsKnown = 0;
        spellsKnownOrPrepared = 0;
        type = 'known';
        break;
      case 'artificer':
        cantripsKnown = 0;
        spellsKnownOrPrepared = 0;
        type = 'prepared';
        break;
    }

    spellcasting = {
      level: srdClass.spellcasting.level || 1,
      ability,
      type,
      cantripsKnown,
      spellsKnownOrPrepared,
      spellSlots: defaultSpellSlots,
    };
  }

  // Process starting equipment options
  const equipment_choices: EquipmentChoice[] = [];
  if (srdClass.starting_equipment_options) {
    srdClass.starting_equipment_options.forEach((option, index) => {
      const choiceId = `${srdClass.index}-choice-${index}`;

      // Convert SRD options to EquipmentItem format
      let options: EquipmentItem[][] = [];
      if (option.from.options) {
        options = option.from.options.map(opt => {
          if (opt.equipment) {
            // Simple equipment reference
            return [{
              name: opt.equipment.name,
              type: 'gear' as const, // Default type, could be enhanced
              quantity: 1
            }];
          } else if (opt.equipment_category) {
            // Equipment category - for now, return a placeholder
            // This would need expansion to actual items in the category
            return [{
              name: `${opt.equipment_category.name} (choose one)`,
              type: 'gear' as const,
              quantity: 1
            }];
          }
          return [];
        }).filter(arr => arr.length > 0);
      } else if (option.from && typeof option.from === 'object' && 'equipment_category' in option.from) {
        const fromObj = option.from as { equipment_category?: { name?: string } };
        if (fromObj.equipment_category?.name) {
          options = [[{
            name: `Any ${fromObj.equipment_category.name}`,
            type: 'gear' as const,
            quantity: 1
          }]];
        }
      }

      if (options.length > 0) {
        equipment_choices.push({
          choiceId,
          description: option.desc,
          options,
          selected: null
        });
      }
    });
  }

  return {
    slug: srdClass.index,
    name: srdClass.name,
    source: `SRD ${year}`,
    edition, // Add edition field
    hit_die: srdClass.hit_die,
    primary_stat: 'Varies', // SRD doesn't specify, would need manual mapping
    save_throws: srdClass.saving_throws.map(st => st.name),
    skill_proficiencies: skillProficiencies,
    num_skill_choices: numSkillChoices,
    musical_instrument_proficiencies: musicalInstrumentProficiencies,
    num_instrument_choices: numInstrumentChoices,
    class_features: [], // Would need to be populated from features database
    description: `${srdClass.name} from the System Reference Document.`,
    keyRole: 'Varies', // Would need manual mapping
    spellcasting, // Include spellcasting data

    // Enhanced fields with defaults (will be overridden by ENHANCED_CLASS_DATA)
    category: 'Martial' as const,
    detailedDescription: `${srdClass.name} is a versatile class with unique abilities.`,
    roleplayingTips: ['Play to your character\'s strengths and background'],
    keyFeatures: [],
    icon: '⚔️',
    themeColor: '#666666',
    proficiencies: {
      armor: Array.from(new Set(armorProficiencies)),
      weapons: Array.from(new Set(weaponProficiencies)),
      tools: Array.from(new Set(toolProficiencies)),
    },

    // Preserve level_1_features for 2024 widget system
    ...(srdClass.level_1_features && { level_1_features: srdClass.level_1_features as Array<Level1Feature> })
  };
}



export function transformEquipment(srdEquip: SRDEquipment): Equipment {
  // For 2024, determine category from equipment_categories array
  let primaryCategory = 'Adventuring Gear';
  const hasWeaponCategory = srdEquip.equipment_categories.some(cat =>
    cat.name.toLowerCase().includes('weapon')
  );
  const hasArmorCategory = srdEquip.equipment_categories.some(cat =>
    cat.name.toLowerCase().includes('armor')
  );
  const isFocusCategory = srdEquip.equipment_categories.some(cat =>
    cat.name.toLowerCase().includes('focus')
  );

  if (hasWeaponCategory) {
    primaryCategory = 'Weapon';
  } else if (hasArmorCategory) {
    primaryCategory = 'Armor';
  } else {
    primaryCategory = srdEquip.equipment_categories[0]?.name || 'Adventuring Gear';
  }

  // Determine if item is equipable (weapons, armor, clothing)
  const isWeapon = primaryCategory === 'Weapon';
  const isArmor = primaryCategory === 'Armor';
  const isClothing = srdEquip.name.toLowerCase().includes('cloth') ||
                    srdEquip.name.toLowerCase().includes('robe') ||
                    (srdEquip.name.toLowerCase().includes('armor') && srdEquip.equipment_categories.some(cat => cat.name.toLowerCase().includes('armor')));
  const equipable = isWeapon || isArmor || isClothing || isFocusCategory;

  // Determine weapon category from equipment_categories
  let weaponCategory: 'Simple' | 'Martial' | undefined;
  let weaponRange: 'Melee' | 'Ranged' | undefined;

  srdEquip.equipment_categories.forEach(cat => {
    if (cat.name.includes('Simple')) weaponCategory = 'Simple';
    if (cat.name.includes('Martial')) weaponCategory = 'Martial';
    if (cat.name.includes('Melee')) weaponRange = 'Melee';
    if (cat.name.includes('Ranged')) weaponRange = 'Ranged';
  });

  let armorCategory: 'Light' | 'Medium' | 'Heavy' | 'Shield' | undefined = srdEquip.armor_category as
    | 'Light'
    | 'Medium'
    | 'Heavy'
    | 'Shield'
    | undefined;
  srdEquip.equipment_categories.forEach(cat => {
    const name = cat.name.toLowerCase();
    if (name.includes('light armor')) armorCategory = 'Light';
    if (name.includes('medium armor')) armorCategory = 'Medium';
    if (name.includes('heavy armor')) armorCategory = 'Heavy';
    if (name.includes('shield')) armorCategory = 'Shield';
  });

  return {
    index: srdEquip.index, // Add missing index field
    slug: srdEquip.index,
    name: srdEquip.name,
    year: 2024,
    equipment_category: primaryCategory,
    equipable,
    cost: {
      quantity: srdEquip.cost.quantity,
      unit: srdEquip.cost.unit as 'cp' | 'sp' | 'gp' | 'pp',
    },
    weight: srdEquip.weight,
    description: srdEquip.description,

    // Weapon fields
    weapon_category: weaponCategory,
    weapon_range: weaponRange,
    damage: srdEquip.damage ? {
      damage_dice: srdEquip.damage.damage_dice,
      damage_type: srdEquip.damage.damage_type.name,
    } : undefined,
    range: srdEquip.range,
    properties: srdEquip.properties, // Keep as object array, not just names
    two_handed_damage: srdEquip.two_handed_damage ? {
      damage_dice: srdEquip.two_handed_damage.damage_dice,
      damage_type: srdEquip.two_handed_damage.damage_type.name,
    } : undefined,
    mastery: srdEquip.mastery, // Keep as object, not just name

    // Armor fields
    armor_category: armorCategory,
    armor_class: srdEquip.armor_class,
    str_minimum: srdEquip.str_minimum,
    stealth_disadvantage: srdEquip.stealth_disadvantage,
    don_time: srdEquip.don_time,
    doff_time: srdEquip.doff_time,

    // Gear fields
    tool_category: srdEquip.tool_category,
    gear_category: srdEquip.gear_category,
    contents: srdEquip.contents
      ?.filter(c => c && c.item && c.item.index && c.item.name)
      .map(c => ({
        item_index: c.item.index,
        item_name: c.item.name,
        quantity: c.quantity,
      })),
  };
}

// --- Data Loading Functions ---

export function loadSpells(): AppSpell[] {
  return (srdSpellsMerged as SRDSpell[]).map(spell => transformSpell(spell));
}

export const SPELL_DATABASE = loadSpells();

export const getSpellsForClass = (classSlug: string): AppSpell[] => {
  // Extract base class name from slug (e.g., 'wizard-evocation' -> 'wizard')
  const baseClass = classSlug.split('-')[0];
  return SPELL_DATABASE.filter(spell => spell.classes.includes(baseClass));
};

export const getCantripsByClass = (classSlug: string): AppSpell[] => {
  return getSpellsForClass(classSlug).filter(spell => spell.level === 0);
};

export const getLeveledSpellsByClass = (classSlug: string, level: number = 1): AppSpell[] => {
  return getSpellsForClass(classSlug).filter(spell => spell.level === level);
};

export function loadSpecies(): Species[] {
  // Return comprehensive species database from JSON
  const baseSpecies = (speciesData as { species: Species[] }).species.map(r => ({
    ...r,
    edition: r.edition || '2014', // Ensure edition is always set, default to 2014
    slug: r.slug || r.name.toLowerCase().replace(/\s+/g, '-') // Ensure slug exists
  })) as Species[];

  // Merge enhanced species data
  return baseSpecies.map(species => {
    const baseSlug = species.slug.replace(/-2024$/, '').replace(/-2014$/, '');
    const enhanced =
      getEnhancedSpeciesData(species.slug) ||
      getEnhancedSpeciesData(baseSlug);
    return enhanced ? { ...species, ...enhanced } : species;
  });
}

// Legacy function for backward compatibility - returns SRD species only
export function loadSRDSpecies(): Species[] {
  const species2014 = (srdRaces2014 as SRDRace[]).map(species => transformSpecies(species, 2014));
  return species2014;
}

// Get all species from categories (flattened)
export function getAllSpecies(edition?: Edition): Species[] {
  let allSpecies = SPECIES_CATEGORIES.flatMap(category => category.species);

  // Filter by edition if specified
  if (edition) {
    allSpecies = allSpecies.filter(species => species.edition === edition);

    // For 2024 edition, filter out "Half-Elf" and "Half-Orc"
    if (edition === '2024') {
      allSpecies = allSpecies.filter(species =>
        species.slug !== 'half-elf' && species.slug !== 'half-orc'
      );
    }
  }

  return allSpecies;
}

// Backwards compatibility aliases (deprecated)
/** @deprecated Use loadSpecies instead */
export const loadRaces = loadSpecies;
/** @deprecated Use loadSRDSpecies instead */
export const loadSRDRaces = loadSRDSpecies;
/** @deprecated Use getAllSpecies instead */
export const getAllRaces = getAllSpecies;

export function loadClasses(edition?: Edition): Class[] {
  const classes2014 = (srdClasses2014 as SRDClass[]).map(cls => transformClass(cls, 2014));
  const classes2024 = (srdClasses2024 as SRDClass[]).map(cls => transformClass(cls, 2024));

  const allClasses = [...classes2014, ...classes2024];

  // Merge enhanced class data
  const classesWithEnhancedData = allClasses.map(cls => {
    const enhanced = getEnhancedClassData(cls.slug);
    return enhanced ? { ...cls, ...enhanced } : cls;
  });

  // Filter by edition if specified
  if (edition) {
    return classesWithEnhancedData.filter(cls => cls.edition === edition);
  }

  return classesWithEnhancedData;
}

export function loadEquipment(): Equipment[] {
  return (srdEquipment as SRDEquipment[]).map(eq => transformEquipment(eq));
}

// Feature interfaces
interface SRDFeature {
  index: string;
  class: { index: string; name: string };
  subclass?: { index: string; name: string };
  name: string;
  level: number;
  desc: string[];
  feature_specific?: {
    [key: string]: {
      choose?: number;
      type?: string;
      from?: {
        option_set_type?: string;
        options?: Array<{
          option_type?: string;
          item?: { index: string; name: string; url: string };
          ability_score?: { index: string; name: string; url: string };
        }>;
      };
    };
  };
}

// Subclass interfaces
interface SRDSubclass {
  index: string;
  class: { index: string; name: string };
  name: string;
  subclass_flavor: string;
  desc: string[];
}

// Transform functions
export function transformFeature(srdFeature: SRDFeature): Feature {
  return {
    slug: srdFeature.index,
    name: srdFeature.name,
    class: srdFeature.class.index,
    subclass: srdFeature.subclass?.index,
    level: srdFeature.level,
    desc: srdFeature.desc,
    featureSpecific: srdFeature.feature_specific,
  };
}

export function transformSubclass(srdSubclass: SRDSubclass): Subclass {
  return {
    slug: srdSubclass.index,
    name: srdSubclass.name,
    class: srdSubclass.class.index,
    desc: srdSubclass.desc,
    subclassFlavor: srdSubclass.subclass_flavor,
  };
}

// Load all features from SRD
export function loadFeatures(): Feature[] {
  return (srdFeatures2014 as SRDFeature[]).map(f => transformFeature(f));
}

// Load all subclasses from SRD
export function loadSubclasses(): Subclass[] {
  const subclasses2014 = (srdSubclasses2014 as SRDSubclass[]).map(sc => transformSubclass(sc));
  const subclasses2018 = (srdSubclasses2018 as SRDSubclass[]).map(sc => transformSubclass(sc));
  const subclasses2020 = (srdSubclasses2020 as SRDSubclass[]).map(sc => transformSubclass(sc));
  const subclasses2020egtw = (srdSubclasses2020egtw as SRDSubclass[]).map(sc => transformSubclass(sc));

  const allSubclasses = [...subclasses2014, ...subclasses2018, ...subclasses2020, ...subclasses2020egtw];

  // Merge enhanced subclass data
  const subclassesWithEnhancedData = allSubclasses.map(subclass => {
    // Create the lookup key in the format "class-subclass"
    const lookupKey = `${subclass.class}-${subclass.slug}`;
    const enhanced = getEnhancedSubclassData(lookupKey);
    return enhanced ? { ...subclass, ...enhanced } : subclass;
  });

  return subclassesWithEnhancedData;
}

// Load all feats (merge SRD + custom feats)
export function loadFeats(): Feat[] {
  // Load custom feats from our JSON
  const customFeats = featsData as Feat[];

  // Load SRD Grappler feat
  const srdGrappler = srdFeats2014 as Array<{ index: string; name: string; prerequisites?: unknown[]; desc: string[]; url: string }>;
  const grapplerFeat: Feat = {
    slug: 'grappler',
    name: 'Grappler',
    source: 'SRD',
    year: 2014,
    category: 'general',
    prerequisite: 'Strength 13 or higher',
    benefits: [
      'Advantage on attack rolls against creatures you\'re grappling',
      'Can restrain a creature grappled by you'
    ],
    description: srdGrappler[0]?.desc?.join('\n\n') || 'You\'ve developed the skills necessary to hold your own in close-quarters grappling.'
  };

  // Check if Grappler already exists in custom feats
  const hasGrappler = customFeats.some(f => f.slug === 'grappler');

  return hasGrappler ? customFeats : [...customFeats, grapplerFeat];
}

// Helper functions to filter features
export function getFeaturesByClass(classSlug: string, level: number): Feature[] {
  return FEATURE_DATABASE.filter(f =>
    f.class === classSlug &&
    f.level <= level &&
    !f.subclass  // Only base class features
  );
}

export function getFeaturesBySubclass(classSlug: string, subclassSlug: string, level: number): Feature[] {
  return FEATURE_DATABASE.filter(f =>
    f.class === classSlug &&
    f.subclass === subclassSlug &&
    f.level <= level
  );
}

export function getSubclassesByClass(classSlug: string): Subclass[] {
  return SUBCLASS_DATABASE.filter(sc => sc.class === classSlug);
}

// Export databases
export const FEATURE_DATABASE = loadFeatures();
export const SUBCLASS_DATABASE = loadSubclasses();
export const FEAT_DATABASE = loadFeats();

export function loadCombatActions(): CombatActionsData {
  return combatActionsData as CombatActionsData;
}

export const COMBAT_ACTIONS = loadCombatActions();

// Export raw data for reference
export { srdSpellsMerged, srdRaces2014, srdClasses2014, srdEquipment, srdFeatures2014, srdSubclasses2014 };


import { SPELL_SLOTS_BY_CLASS } from '../data/spellSlots';
import cantripsData from '../data/cantrips.json';
import spellsKnownData from '../data/spellsKnown.json';

// --- Static Data and Helper Functions from App.tsx ---

export const PROFICIENCY_BONUSES = gameConstantsData.PROFICIENCY_BONUSES;
export { spellsKnownData as SPELLS_KNOWN_BY_CLASS };

export function getModifier(abilityScore: number): number {
  return Math.floor((abilityScore - 10) / 2);
}

export const SKILL_TO_ABILITY: Record<SkillName, AbilityName> = gameConstantsData.SKILL_TO_ABILITY as Record<SkillName, AbilityName>;

export const ALL_SKILLS: SkillName[] = Object.keys(SKILL_TO_ABILITY) as SkillName[];

export function loadAlignments(): Alignment[] {
  return alignmentsData as Alignment[];
}

export const ALIGNMENTS_DATA: Alignment[] = loadAlignments();

export const ALIGNMENTS = ALIGNMENTS_DATA.map(a => a.name);

export const ALIGNMENT_INFO: Record<string, string> = ALIGNMENTS_DATA.reduce((acc, alignment) => {
  acc[alignment.name] = alignment.short_desc;
  return acc;
}, {} as Record<string, string>);

export const BACKGROUNDS: Background[] = backgroundsData as Background[];

// Comprehensive species database with 40+ species from multiple sources
// Load species from JSON data
const COMPREHENSIVE_SPECIES: Species[] = loadSpecies();

/**
 * Build an alias map from legacy slugs to canonical species slugs.
 * Includes self-maps so resolveSpeciesSlug always returns a valid slug.
 */
const buildSpeciesAliasMap = (speciesList: Species[]): Record<string, string> => {
  return speciesList.reduce((map, species) => {
    map[species.slug] = species.slug;
    (species.legacySlugs || []).forEach(oldSlug => {
      map[oldSlug] = species.slug;
    });
    (species.slugAliases || []).forEach(alias => {
      map[alias] = species.slug;
    });
    return map;
  }, {} as Record<string, string>);
};

/** Maps legacy/alias slugs to canonical species slugs. */
export const SPECIES_ALIAS_MAP = buildSpeciesAliasMap(COMPREHENSIVE_SPECIES);

/**
 * Normalize a species slug to its canonical value, preserving unknown slugs as-is.
 * @param slug raw species slug (possibly legacy)
 */
export const resolveSpeciesSlug = (slug: string): string => {
  if (!slug) return slug;
  return SPECIES_ALIAS_MAP[slug] || SPECIES_ALIAS_MAP[slug.toLowerCase()] || slug;
};

interface SpeciesCategoryData {
  name: string;
  icon: string;
  description: string;
  filterCriteria: {
    core?: boolean;
    expanded?: boolean;
    tags?: string[];
  };
}

export const SPECIES_CATEGORIES: SpeciesCategory[] = speciesCategoriesData.map((category: SpeciesCategoryData) => {
  const { core, expanded, tags } = category.filterCriteria;

  const filteredSpecies = COMPREHENSIVE_SPECIES.filter(species => {
    const matchesCore = core !== undefined ? species.core === core : true;
    const matchesExpanded = expanded !== undefined ? species.expanded === expanded : true;
    const matchesTags = tags && tags.length ? (species.tags || []).some(tag => tags.includes(tag)) : true;
    return matchesCore && matchesExpanded && matchesTags;
  });

  // Debug logging for category construction
  if (filteredSpecies.length === 0) {
    log.warn('Species category empty after filtering', { category: category.name, filterCriteria: category.filterCriteria });
  }

  return {
    name: category.name,
    icon: category.icon,
    description: category.description,
    species: filteredSpecies
  };
});

// Backwards compatibility (deprecated)
/** @deprecated Use SPECIES_CATEGORIES instead */
export const RACE_CATEGORIES = SPECIES_CATEGORIES;

// Enhanced class data with rich descriptions and categorization
interface EnhancedClassData {
  [key: string]: Partial<Class>;
}

interface ClassCategoryData {
  name: string;
  icon: string;
  description: string;
  classSlugs: string[];
}

// Helper function to get enhanced class data
export function getEnhancedClassData(classSlug: string): Partial<Class> | undefined {
  return (enhancedClassData as EnhancedClassData)[classSlug];
}

export function getEnhancedSubclassData(subclassSlug: string): Partial<Subclass> | undefined {
  // Enhanced data uses format like "rogue-phantom" for subclass slugs
  return (enhancedClassData as EnhancedClassData)[subclassSlug];
}

// Helper function to get enhanced species data
export function getEnhancedSpeciesData(speciesSlug: string): Partial<Species> | undefined {
  return (enhancedSpeciesData as unknown as Record<string, Partial<Species>>)[speciesSlug];
}

// Enhanced class categories with rich data - filtered by edition
export function getClassCategories(edition?: Edition): ClassCategory[] {
  return classCategoriesData.map((category: ClassCategoryData) => ({
    name: category.name,
    icon: category.icon,
    description: category.description,
    classes: loadClasses(edition).filter(cls =>
      category.classSlugs.includes(cls.slug)
    ).map(cls => {
      const enhanced = (enhancedClassData as EnhancedClassData)[cls.slug];
      return enhanced ? { ...cls, ...enhanced } : cls;
    })
  }));
}

// Legacy constant for backward compatibility - shows all classes
export const CLASS_CATEGORIES: ClassCategory[] = getClassCategories();

export const EQUIPMENT_PACKAGES: EquipmentPackage[] = equipmentPackagesData;

export const FIGHTING_STYLES: FightingStyle[] = fightingStylesData.map(style => ({
  ...style,
  slug: style.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
} as FightingStyle));

export { SPELL_SLOTS_BY_CLASS, cantripsData as CANTRIPS_KNOWN_BY_CLASS };

// New JSON data exports
export const SPELLCASTING_TYPE_MAP = spellcastingTypesData.SPELLCASTING_TYPE_MAP;
export const SPECIES_LANGUAGE_MAP = speciesLanguagesData.SPECIES_LANGUAGE_MAP as Record<string, string[]>;
/** @deprecated Use SPECIES_LANGUAGE_MAP instead. */
export const RACIAL_LANGUAGE_MAP = SPECIES_LANGUAGE_MAP;
export const BACKGROUND_DEFAULTS = backgroundDefaultsData.BACKGROUND_DEFAULTS;

// --- Randomization Utilities ---

/**
 * Get a random element from an array
 */
const getRandomElement = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

/**
 * Randomize character level with bias toward milestone levels
 */
export const randomizeLevel = (): number => {
  const milestoneLevels = levelConstantsData.milestoneLevels;
  const regularLevels = Array.from({ length: 20 }, (_, i) => i + 1).filter(l => !milestoneLevels.includes(l));

  // 70% chance for milestone levels, 30% for regular levels
  return Math.random() < 0.7 ? getRandomElement(milestoneLevels) : getRandomElement(regularLevels);
};

/**
 * Randomize character identity (alignment, background).
 * Name generation is handled in the final step where class/species context exists.
 */
export const randomizeIdentity = (species?: string): { name?: string; alignment: string; background: string; backgroundSlug?: string } => {
  const background = getRandomElement(BACKGROUNDS);
  return {
    name: species ? generateSpeciesSpecificName(species) : undefined,
    alignment: getRandomElement(ALIGNMENTS),
    background: background.name,
    backgroundSlug: background.slug
  };
};

/**
 * Randomize Background ASI selections for 2024 origins.
 */
export const randomizeBackgroundAbilityChoices = (
  backgroundSlug: string,
  edition: Edition
): { method: '2/1' | '1/1/1'; bonuses: Partial<Record<AbilityName, number>> } | undefined => {
  if (edition !== '2024') return undefined;
  const background = BACKGROUNDS.find(bg => bg.slug === backgroundSlug || bg.name === backgroundSlug);
  const abilityScores = background?.abilityScores;
  if (!abilityScores?.from?.length) return undefined;

  const availableOptions = [...abilityScores.from] as AbilityName[];
  const canUseTriple = availableOptions.length >= 3;
  const method: '2/1' | '1/1/1' = canUseTriple && Math.random() > 0.5 ? '1/1/1' : '2/1';
  const bonuses: Partial<Record<AbilityName, number>> = {};
  const shuffled = [...availableOptions].sort(() => Math.random() - 0.5);

  if (method === '2/1') {
    const plusTwo = shuffled[0];
    const plusOne = shuffled.find(ability => ability !== plusTwo);
    if (plusTwo) bonuses[plusTwo] = 2;
    if (plusOne) bonuses[plusOne] = 1;
  } else {
    shuffled.slice(0, Math.min(3, availableOptions.length)).forEach(ability => {
      bonuses[ability] = 1;
    });
  }

  return { method, bonuses };
};

/**
 * Generate a species-specific name
 */
export const generateSpeciesSpecificName = (species: string, gender?: 'male' | 'female'): string => {
  return generateName({ race: species, gender }).name;
};

/**
 * Randomize species selection
 */
export const randomizeSpecies = (): string => {
  const category = getRandomElement(SPECIES_CATEGORIES);
  const species = getRandomElement(category.species);
  return species.slug;
};

// Backwards compatibility (deprecated)
/** @deprecated Use generateSpeciesSpecificName instead */
export const generateRaceSpecificName = generateSpeciesSpecificName;
/** @deprecated Use randomizeSpecies instead */
export const randomizeRace = randomizeSpecies;

/**
 * Randomize class and required skills
 */
export const randomizeClassAndSkills = (): { classSlug: string; selectedSkills: SkillName[]; subclassSlug?: string } => {
  const category = getRandomElement(CLASS_CATEGORIES);
  const _class = getRandomElement(category.classes);
  const classData = loadClasses().find(c => c.slug === _class.slug);

  if (!classData) {
    throw new Error(`Class data not found for ${category.name}`);
  }

  // Randomly select required number of skills from class options
  const availableSkills = classData.skill_proficiencies;
  const numSkills = classData.num_skill_choices || 0;
  const selectedSkills: string[] = [];

  if (numSkills > 0 && availableSkills.length > 0) {
    const shuffled = [...availableSkills].sort(() => Math.random() - 0.5);
    selectedSkills.push(...shuffled.slice(0, numSkills));
  }

  // Random subclass if available
  const subclasses = getSubclassesByClass(_class.slug);
  const subclassSlug = subclasses.length > 0 ? getRandomElement(subclasses).slug : undefined;

  return {
    classSlug: _class.slug,
    selectedSkills: selectedSkills as SkillName[],
    subclassSlug
  };
};

/**
 * Randomize fighting style for applicable classes
 */
export const randomizeFightingStyle = (classSlug: string): string | undefined => {
  const applicableClasses = ['fighter', 'paladin', 'ranger'];
  if (!applicableClasses.includes(classSlug)) {
    return undefined;
  }

  // Get styles that include this class in their prerequisite
  const availableStyles = FIGHTING_STYLES.filter(style =>
    style.prerequisite.toLowerCase().includes(classSlug)
  );

  // If no specific styles for this class, allow any style
  const stylePool = availableStyles.length > 0 ? availableStyles : FIGHTING_STYLES;
  return getRandomElement(stylePool).name;
};

interface CantripsData {
  [key: string]: {
    [key: number]: number;
  };
}

/**
 * Randomize spell selection for spellcasters
 */
export const randomizeSpells = (classSlug: string, level: number = 1): { selectedCantrips: string[]; selectedSpells: string[] } => {
  const classData = loadClasses().find(c => c.slug === classSlug);
  if (!classData?.spellcasting) {
    return { selectedCantrips: [], selectedSpells: [] };
  }

  const cantrips = getCantripsByClass(classSlug);
  const spells = getLeveledSpellsByClass(classSlug, level);

  // Get cantrip limit for this class and level
  const cantripLimit = (cantripsData as CantripsData)[classSlug]?.[level] || 0;
  const spellLimit = SPELL_SLOTS_BY_CLASS[classSlug]?.[level]?.[0] || 0; // Level 1 spells

  const selectedCantrips = cantrips.length > 0 && cantripLimit > 0
    ? [...cantrips].sort(() => Math.random() - 0.5).slice(0, cantripLimit).map(s => s.slug)
    : [];

  const selectedSpells = spells.length > 0 && spellLimit > 0
    ? [...spells].sort(() => Math.random() - 0.5).slice(0, spellLimit).map(s => s.slug)
    : [];

  return { selectedCantrips, selectedSpells };
};

/**
 * Randomize ability scores
 */
export const randomizeAbilities = (): { abilities: Record<string, number>; abilityScoreMethod: 'standard-array' | 'point-buy' | 'standard-roll' } => {
  const methods: ('standard-array' | 'point-buy' | 'standard-roll')[] = ['standard-array', 'point-buy', 'standard-roll'];
  const method = getRandomElement(methods);

  let abilities: Record<string, number>;

  if (method === 'standard-array') {
    // Standard array: 15, 14, 13, 12, 10, 8
    const scores = [15, 14, 13, 12, 10, 8];
    const abilityNames = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    const shuffled = [...abilityNames].sort(() => Math.random() - 0.5);

    abilities = {};
    shuffled.forEach((ability, index) => {
      abilities[ability] = scores[index];
    });
  } else if (method === 'point-buy') {
    // Point buy: start with 8 in each, distribute 27 points
    abilities = { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 };
    let points = 27;

    while (points > 0) {
      const ability = getRandomElement(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
      const current = abilities[ability];
      const cost = current >= 13 ? 2 : 1; // 14+ costs 2 points

      if (current < 15 && points >= cost) {
        abilities[ability] = current + 1;
        points -= cost;
      }
    }
  } else {
    // Standard roll: 4d6 drop lowest for each ability
    abilities = {};
    ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].forEach(ability => {
      const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
      rolls.sort((a, b) => b - a); // Sort descending
      abilities[ability] = rolls[0] + rolls[1] + rolls[2]; // Drop lowest
    });
  }

  return { abilities, abilityScoreMethod: method };
};

/**
 * Randomize feat selection
 */
export const randomizeFeats = (): string[] => {
  // For now, just return empty array as feats are optional
  // Could be enhanced to select appropriate feats based on character
  return [];
};

/**
 * Randomize equipment choices
 */
export const randomizeEquipmentChoices = (classSlug: string): EquipmentChoice[] => {
  const classData = loadClasses().find(c => c.slug === classSlug);
  if (!classData?.equipment_choices) {
    return [];
  }

  // For each equipment choice, randomly select one option
  return classData.equipment_choices.map(choice => ({
    ...choice,
    selected: Math.floor(Math.random() * choice.options.length)
  }));
};

/**
 * Randomize starting equipment with background/class-aware logic.
 */
export const randomizeStartingEquipment = (
  classSlug: string,
  backgroundSlug: string,
  edition: Edition
): {
  equipmentChoices: EquipmentChoice[];
  startingInventory: EquippedItem[];
  equipmentChoice?: 'background' | 'gold';
  equipmentGold?: number;
} => {
  const equipmentChoices = randomizeEquipmentChoices(classSlug);
  const background = BACKGROUNDS.find(bg => bg.slug === backgroundSlug || bg.name === backgroundSlug);
  const backgroundName = background?.name || backgroundSlug;
  const equipmentData = loadEquipment();

  const findEquipmentSlug = (itemName: string): string => {
    const normalized = itemName.trim().toLowerCase();
    const equipmentMatch = equipmentData.find(eq => eq.name.toLowerCase() === normalized);
    if (equipmentMatch) return equipmentMatch.slug;

    const packageMatch = EQUIPMENT_PACKAGES.flatMap(pkg => pkg.items)
      .find(item => item.name.toLowerCase() === normalized);
    if (packageMatch?.slug) return packageMatch.slug;

    return `custom-${normalized.replace(/[^a-z0-9]+/g, '-')}`;
  };

  const quickStartPresets = loadQuickStartEquipment();
  const baseClassSlug = classSlug.split('-')[0];
  const classPreset = quickStartPresets.classes[baseClassSlug] || quickStartPresets.classes[classSlug];
  const normalizedBgName = backgroundName.toLowerCase().replace(/\s+/g, '_').replace(/['"]/g, '');
  const backgroundPreset = quickStartPresets.backgrounds[normalizedBgName];

  const mergedQuickStartItems = [
    ...(classPreset?.items || []),
    ...(backgroundPreset?.items || [])
  ];

  const mergedInventory: EquippedItem[] = mergedQuickStartItems.reduce<EquippedItem[]>((acc, item) => {
    const existing = acc.find(i => i.equipmentSlug === item.equipmentSlug && !!i.equipped === !!item.equipped);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      acc.push({
        equipmentSlug: item.equipmentSlug,
        quantity: item.quantity,
        equipped: item.equipped || false
      });
    }
    return acc;
  }, []);

  let startingInventory: EquippedItem[] = mergedInventory;
  let equipmentChoice: 'background' | 'gold' | undefined;
  let equipmentGold: number | undefined;

  if (edition === '2024' && background?.equipment?.length) {
    equipmentChoice = 'background';
    startingInventory = background.equipment.map(itemName => ({
      equipmentSlug: findEquipmentSlug(itemName),
      quantity: 1,
      equipped: false
    }));
  } else if (edition === '2024') {
    equipmentChoice = 'background';
  }

  return { equipmentChoices, startingInventory, equipmentChoice, equipmentGold };
};

/**
 * Randomize language selection
 */
export const randomizeLanguages = (
  speciesSlug: string,
  backgroundSlug: string,
  edition: Edition = '2014',
  abilities?: Record<AbilityName, number>
): string[] => {
  const selected: string[] = [];
  const autoLanguages = new Set<string>();
  autoLanguages.add('Common');

  const speciesLanguages = SPECIES_LANGUAGE_MAP[speciesSlug] || SPECIES_LANGUAGE_MAP[`${speciesSlug}-${edition}`] || [];
  speciesLanguages.forEach(lang => autoLanguages.add(lang));

  const background = BACKGROUNDS.find(bg => bg.slug === backgroundSlug || bg.name === backgroundSlug);
  let optionalChoices = 0;

  if (background?.languages?.length) {
    background.languages.forEach(lang => {
      const normalized = lang.toLowerCase();
      if (normalized.includes('two') && normalized.includes('choice')) {
        optionalChoices += 2;
      } else if (normalized.includes('one') && normalized.includes('choice')) {
        optionalChoices += 1;
      } else {
        autoLanguages.add(lang);
      }
    });
  }

  const intelligenceScore = abilities?.INT;
  const maxLanguages = intelligenceScore !== undefined ? 1 + Math.max(0, getModifier(intelligenceScore)) : 1;
  const selectionSlots = maxLanguages + (edition === '2024' ? 0 : optionalChoices);

  const pool = getSelectableLanguages(edition, ['standard', 'rare'])
    .map(lang => lang.name)
    .filter(name => !autoLanguages.has(name));

  const shuffledPool = pool.sort(() => Math.random() - 0.5);
  selected.push(...shuffledPool.slice(0, Math.min(selectionSlots, shuffledPool.length)));

  return selected;
};

/**
 * Randomize personality traits
 */
export const randomizePersonality = (): { personality: string; ideals: string; bonds: string; flaws: string } => {
  const personalities = [
    "I'm always polite and respectful.",
    "I have a joke for every occasion.",
    "I never pass up a chance to learn something new.",
    "I have a strong sense of fair play.",
    "I am suspicious of strangers and expect the worst of them.",
    "I like to know as much as I can about everything.",
    "I am slow to trust members of other races, townsfolk, or anyone else I don't know.",
    "I am always calm, no matter what the situation.",
    "I idolize a particular hero of my faith.",
    "I see omens in death.",
    "I am always picking things up, absently fiddling with them, and sometimes accidentally breaking them.",
    "I am horribly, horribly awkward in social situations.",
    "I am suspicious of new ideas and new ways of doing things.",
    "I am a sucker for a pretty face.",
    "I am deathly afraid of enclosed spaces.",
    "I am well known for my work, and I want to make certain everyone appreciates it.",
    "I am not used to wearing nice clothes.",
    "I connect everything that happens to me to a grand, cosmic plan.",
    "I am always working on some project or other.",
    "I am terribly jealous of anyone who can outshine my handiwork."
  ];

  const ideals = [
    "Change. We must help bring change about. (Chaotic)",
    "Tradition. The ancient ways of our people must be preserved. (Lawful)",
    "Honor. I will uphold my honor no matter the cost. (Lawful)",
    "Power. I want power, and I will do anything to get it. (Evil)",
    "Family. Blood runs thicker than water. (Any)",
    "Fairness. No one should get preferential treatment. (Lawful)",
    "Freedom. Everyone should be free to pursue his or her livelihood. (Chaotic)",
    "Responsibility. I do what I must and obey just authority. (Lawful)",
    "Independence. I am a free spirit - no one tells me what to do. (Chaotic)",
    "Might. The strongest are meant to rule. (Evil)",
    "Live and Let Live. Meddling in the affairs of others only causes trouble. (Neutral)",
    "Noble Obligation. It is my duty to protect and care for the people beneath me. (Good)",
    "Change. Life is like the seasons, in constant change, and we must change with it. (Chaotic)",
    "Greater Good. My gifts are meant to be shared with all, not used for my own benefit. (Good)",
    "Logic. Emotions must not cloud our logical thinking. (Lawful)",
    "Free Thinking. Inquiry and curiosity are the pillars of progress. (Chaotic)",
    "Power. Knowledge is the path to power and domination. (Evil)",
    "Self-Improvement. The goal of a life of study is the betterment of oneself. (Any)",
    "Respect. Respect is due to me because of my position, but all people regardless of station deserve to be treated with dignity. (Good)",
    "Community. It is the duty of all civilized people to strengthen the bonds of community and the security of civilization. (Lawful)"
  ];

  const bonds = [
    "I owe my guild a great debt for forging me into the person I am today.",
    "I will face any challenge to win the approval of my family.",
    "My honor is my life.",
    "I owe everything to my mentor - a horrible person who's probably rotting in jail somewhere.",
    "I protect those who cannot protect themselves.",
    "I work to preserve a library, university, scriptorium, or monastery.",
    "My town or city is my home, and I'll fight to defend it.",
    "I idolize a hero of the old tales and measure my deeds against that person's.",
    "I am the last of my tribe, and it is up to me to ensure their names enter legend.",
    "I suffer awful visions of a coming disaster and will do anything to prevent it.",
    "It is my duty to provide children to sustain my tribe.",
    "I worked the land, I love the land, and I will protect the land.",
    "A proud noble once gave me a horrible beating, and I will take my revenge on any bully I encounter.",
    "My tools are symbols of my past life, and I carry them so that I will never forget my roots.",
    "I protect those who cannot protect themselves.",
    "I wish my childhood sweetheart had come with me to pursue my destiny.",
    "The workshop where I learned my trade is the most important place in the world to me.",
    "I created an extraordinary work for someone, and then found them unworthy to receive it. I'm still looking for someone worthy.",
    "I owe my survival to another urchin who taught me to live on the streets.",
    "I would still lay down my life for the people I served with."
  ];

  const flaws = [
    "I am suspicious of strangers and expect the worst of them.",
    "Once someone questions my courage, I never back down no matter how dangerous the situation.",
    "Once I start drinking, it's hard for me to stop.",
    "I can't help but pocket loose coins and other trinkets I come across.",
    "I always have a plan for what to do when things go wrong.",
    "I am always calm, no matter what the situation. I never raise my voice or let my emotions control me.",
    "I am incredibly slow to trust. Those who seem the fairest often have the most to hide.",
    "I am suspicious of strangers and expect the worst of them.",
    "I like keeping secrets and won't share them with anyone.",
    "I secretly believe that everyone is beneath me.",
    "I hide a truly scandalous secret that could ruin my family forever.",
    "I too often hear veiled insults and threats in every word addressed to me, and I'm quick to anger at them.",
    "I turn tail and run when things look bad.",
    "When I see something valuable, I can't think about anything but how to steal it.",
    "When faced with a choice between money and my friends, I usually choose the money.",
    "In fact, the worst insult I can receive is to be ignored.",
    "I have no respect for anyone who is not a proven warrior.",
    "I made a terrible mistake in battle that cost many lives - and I would do anything to keep that mistake secret.",
    "My hatred of my enemies is blind and unreasoning.",
    "I obey the law, even if the law causes misery."
  ];

  return {
    personality: getRandomElement(personalities),
    ideals: getRandomElement(ideals),
    bonds: getRandomElement(bonds),
    flaws: getRandomElement(flaws)
  };
};

/**
 * Extract proficiencies from species data
 */
export const getSpeciesProficiencies = (speciesSlug: string): { armor?: string[]; weapons?: string[]; tools?: string[] } => {
  const canonicalSlug = resolveSpeciesSlug(speciesSlug);
  const species = loadSpecies().find(s => s.slug === canonicalSlug);
  if (!species) return { armor: [], weapons: [], tools: [] };

  const proficiencies: { armor?: string[]; weapons?: string[]; tools?: string[] } = {
    armor: [],
    weapons: [],
    tools: []
  };

  // Check species traits for proficiency information
  species.species_traits.forEach(trait => {
    const traitLower = trait.toLowerCase();

    // Armor proficiencies
    if (traitLower.includes('light armor') || traitLower.includes('medium armor') || traitLower.includes('heavy armor') || traitLower.includes('shields')) {
      if (!proficiencies.armor) proficiencies.armor = [];
      if (traitLower.includes('light')) proficiencies.armor.push('Light armor');
      if (traitLower.includes('medium')) proficiencies.armor.push('Medium armor');
      if (traitLower.includes('heavy')) proficiencies.armor.push('Heavy armor');
      if (traitLower.includes('shields')) proficiencies.armor.push('Shields');
    }

    // Weapon proficiencies
    if (traitLower.includes('weapon training') || traitLower.includes('combat training')) {
      if (!proficiencies.weapons) proficiencies.weapons = [];
      // This is a simplified extraction - in a real implementation, you'd parse the trait descriptions
      if (traitLower.includes('battleaxe') || traitLower.includes('handaxe') || traitLower.includes('warhammer')) {
        proficiencies.weapons.push('Battleaxe', 'Handaxe', 'Light hammer', 'Warhammer');
      }
    }

    // Tool proficiencies
    if (traitLower.includes('tool proficiency') || traitLower.includes('smith') || traitLower.includes('brewer')) {
      if (!proficiencies.tools) proficiencies.tools = [];
      if (traitLower.includes('smith')) proficiencies.tools.push('Smith\'s tools');
      if (traitLower.includes('brewer')) proficiencies.tools.push('Brewer\'s supplies');
    }
  });

  return proficiencies;
};

// Backwards compatibility (deprecated)
/** @deprecated Use getSpeciesProficiencies instead */
export const getRaceProficiencies = getSpeciesProficiencies;

/**
 * Extract proficiencies from class data
 */
export const getClassProficiencies = (classSlug: string): { armor?: string[]; weapons?: string[]; tools?: string[] } => {
  // Hard-coded proficiencies based on D&D 5e rules
  // This ensures accuracy rather than relying on text parsing

  const proficiencies: { armor?: string[]; weapons?: string[]; tools?: string[] } = {
    armor: [],
    weapons: [],
    tools: []
  };

  switch (classSlug) {
    case 'barbarian':
      proficiencies.armor = ['Light armor', 'Medium armor', 'Shields'];
      proficiencies.weapons = ['Simple weapons', 'Martial weapons'];
      break;

    case 'bard':
      proficiencies.armor = ['Light armor'];
      proficiencies.weapons = ['Simple weapons', 'Hand crossbows', 'Longswords', 'Rapiers', 'Shortswords'];
      proficiencies.tools = ['Three musical instruments of your choice'];
      break;

    case 'cleric':
      proficiencies.armor = ['Light armor', 'Medium armor', 'Shields'];
      proficiencies.weapons = ['Simple weapons'];
      break;

    case 'druid':
      proficiencies.armor = ['Light armor', 'Medium armor', 'Shields'];
      proficiencies.weapons = ['Clubs', 'Daggers', 'Darts', 'Javelins', 'Maces', 'Quarterstaffs', 'Scimitars', 'Sickles', 'Slings', 'Spears'];
      proficiencies.tools = ['Herbalism kit'];
      break;

    case 'fighter':
      proficiencies.armor = ['Light armor', 'Medium armor', 'Heavy armor', 'Shields'];
      proficiencies.weapons = ['Simple weapons', 'Martial weapons'];
      break;

    case 'monk':
      proficiencies.weapons = ['Simple weapons', 'Shortswords'];
      proficiencies.tools = ['One type of artisan\'s tools or musical instrument'];
      break;

    case 'paladin':
      proficiencies.armor = ['Light armor', 'Medium armor', 'Heavy armor', 'Shields'];
      proficiencies.weapons = ['Simple weapons', 'Martial weapons'];
      break;

    case 'ranger':
      proficiencies.armor = ['Light armor', 'Medium armor', 'Shields'];
      proficiencies.weapons = ['Simple weapons', 'Martial weapons'];
      break;

    case 'rogue':
      proficiencies.armor = ['Light armor'];
      proficiencies.weapons = ['Simple weapons', 'Hand crossbows', 'Longswords', 'Rapiers', 'Shortswords'];
      proficiencies.tools = ['Thieves\' tools'];
      break;

    case 'sorcerer':
      proficiencies.weapons = ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light crossbows'];
      break;

    case 'warlock':
      proficiencies.armor = ['Light armor'];
      proficiencies.weapons = ['Simple weapons'];
      break;

    case 'wizard':
      proficiencies.weapons = ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light crossbows'];
      break;

    case 'artificer':
      proficiencies.armor = ['Light armor', 'Medium armor', 'Shields'];
      proficiencies.weapons = ['Simple weapons'];
      proficiencies.tools = ['Thieves\' tools', 'One type of artisan\'s tools'];
      break;

    default:
      // Unknown class
      break;
  }

  return proficiencies;
};

/**
 * Extract proficiencies from background data
 */
export const getBackgroundProficiencies = (background: string): { armor?: string[]; weapons?: string[]; tools?: string[] } => {
  // Simplified background proficiency extraction
  const proficiencies: { armor?: string[]; weapons?: string[]; tools?: string[] } = {};

  const bgLower = background.toLowerCase();

  // Tool proficiencies based on background
  if (bgLower.includes('criminal') || bgLower.includes('spy')) {
    proficiencies.tools = ['Thieves\' tools'];
  }
  if (bgLower.includes('entertainer')) {
    proficiencies.tools = ['Disguise kit', 'One musical instrument'];
  }
  if (bgLower.includes('guild artisan')) {
    proficiencies.tools = ['One type of artisan\'s tools'];
  }

  return proficiencies;
};

/**
 * Aggregate proficiencies from species, class, and background
 */
export const aggregateProficiencies = (speciesSlug: string, classSlug: string, background: string): { armor?: string[]; weapons?: string[]; tools?: string[] } => {
  const speciesProf = getSpeciesProficiencies(speciesSlug);
  const classProf = getClassProficiencies(classSlug);
  const backgroundProf = getBackgroundProficiencies(background);

  const aggregated: { armor: string[]; weapons: string[]; tools: string[] } = {
    armor: [],
    weapons: [],
    tools: []
  };

  // Merge armor proficiencies
  const armorSet = new Set([...(speciesProf.armor || []), ...(classProf.armor || []), ...(backgroundProf.armor || [])]);
  aggregated.armor = Array.from(armorSet);

  // Merge weapon proficiencies
  const weaponSet = new Set([...(speciesProf.weapons || []), ...(classProf.weapons || []), ...(backgroundProf.weapons || [])]);
  aggregated.weapons = Array.from(weaponSet);

  // Merge tool proficiencies
  const toolSet = new Set([...(speciesProf.tools || []), ...(classProf.tools || []), ...(backgroundProf.tools || [])]);
  aggregated.tools = Array.from(toolSet);

  return aggregated;
};

/**
 * Get hit die for a character class
 */
export const getHitDieForClass = (classSlug: string): number => {
  // Extract base class name from slug (e.g., 'wizard-evocation' -> 'wizard')
  const baseClass = classSlug.split('-')[0];

  const hitDice: Record<string, number> = {
    'barbarian': 12,
    'fighter': 10,
    'paladin': 10,
    'ranger': 10,
    'bard': 8,
    'cleric': 8,
    'druid': 8,
    'monk': 8,
    'rogue': 8,
    'sorcerer': 6,
    'warlock': 8,
    'wizard': 6,
  };

  return hitDice[baseClass] || 8; // Default to d8 if class not found
};

// ==================== Monster System ====================

export interface MonsterTypeCategory {
  type: MonsterType;
  name: string;
  icon: string;
  description: string;
}

export const MONSTER_TYPE_CATEGORIES: MonsterTypeCategory[] = [
  { type: 'aberration', name: 'Aberrations', icon: '👁️', description: 'Utterly alien beings' },
  { type: 'beast', name: 'Beasts', icon: '🐻', description: 'Natural animals' },
  { type: 'celestial', name: 'Celestials', icon: '✨', description: 'Divine beings from the Upper Planes' },
  { type: 'construct', name: 'Constructs', icon: '🗿', description: 'Animated objects and golems' },
  { type: 'dragon', name: 'Dragons', icon: '🐉', description: 'Ancient reptilian creatures' },
  { type: 'elemental', name: 'Elementals', icon: '🔥', description: 'Beings of pure elemental energy' },
  { type: 'fey', name: 'Fey', icon: '🧚', description: 'Magical creatures from the Feywild' },
  { type: 'fiend', name: 'Fiends', icon: '😈', description: 'Evil beings from the Lower Planes' },
  { type: 'giant', name: 'Giants', icon: '⛰️', description: 'Towering humanoid creatures' },
  { type: 'humanoid', name: 'Humanoids', icon: '🧑', description: 'People and human-like creatures' },
  { type: 'monstrosity', name: 'Monstrosities', icon: '🦎', description: 'Unnatural creatures and hybrids' },
  { type: 'ooze', name: 'Oozes', icon: '💧', description: 'Amorphous blobs' },
  { type: 'plant', name: 'Plants', icon: '🌿', description: 'Vegetation creatures' },
  { type: 'undead', name: 'Undead', icon: '💀', description: 'Once-living creatures' },
];

/**
 * Load and return all monsters from the SRD
 * No transformation needed - use SRD format directly
 */
export const loadMonsters = (): Monster[] => {
  return srdMonsters2014.map(monster => ({
    ...monster,
    senses: Object.fromEntries(
      Object.entries(monster.senses || {}).filter(([_, value]) => value !== undefined)
    ) as Record<string, string | number>
  })) as Monster[];
};

// Equipment System Functions
export function loadQuickStartEquipment(): QuickStartPresets {
  return quickStartEquipmentPresets;
}

export function loadStartingWealthRules(): ClassWealthRule[] {
  return (startingWealthData as { starting_wealth: ClassWealthRule[] }).starting_wealth;
}

export function loadNewPlayerShop(): ShopItem[] {
  return (newPlayerShopData as { shop_inventory: ShopItem[] }).shop_inventory;
}

/**
 * Monster database constant (334 SRD monsters)
 */
export const MONSTER_DATABASE = loadMonsters();
