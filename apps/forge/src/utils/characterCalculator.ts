import { Character, CharacterCreationData, AbilityName, SkillName } from '../types/dnd';
import { calculateKnownLanguages } from '../utils/languageUtils';
import { initializeSpellcasting } from '../utils/spellcastingInit';
import { generateUUID } from '../services/diceService';
import { processEquipment } from '../utils/equipmentProcessor';
import {
  getAllSpecies,
  loadClasses,
  loadEquipment,
  PROFICIENCY_BONUSES,
  getModifier,
  SKILL_TO_ABILITY,
  ALL_SKILLS,
  BACKGROUNDS,
  getFeaturesByClass,
  getFeaturesBySubclass,
  getHitDieForClass,
  EQUIPMENT_PACKAGES,
} from '../services/dataService';
import {
  BASE_ARMOR_CLASS,
  calculateArmorClassByCategory,
  DEFAULT_WALKING_SPEED,
  DEFAULT_STARTING_CURRENCY,
  DEFAULT_CHARACTER_NAME,
  LEVEL_1_PROFICIENCY_BONUS,
  type ArmorCategory,
} from '../constants/combat';

export const calculateCharacterStats = (data: CharacterCreationData): Character => {
  const speciesData = getAllSpecies().find(s => s.slug === data.speciesSlug);
  const classData = loadClasses().find(c => c.slug === data.classSlug);

  if (!speciesData || !classData) {
    throw new Error("Incomplete creation data.");
  }

  const finalAbilities: Character['abilities'] = {} as Character['abilities'];

  // 1. Calculate Abilities with Racial Bonuses
  (Object.keys(data.abilities) as AbilityName[]).forEach((ability) => {
    const rawScore = data.abilities[ability] + (speciesData.ability_bonuses?.[ability] || 0);
    const modifier = getModifier(rawScore);
    finalAbilities[ability] = { score: rawScore, modifier };
  });

  const level = data.level;
  const pb = PROFICIENCY_BONUSES[level - 1] || LEVEL_1_PROFICIENCY_BONUS;

  // 2. Calculate Hit Points (Based on chosen method)
  let hitDieValue: number;
  if (data.hpCalculationMethod === 'rolled' && data.rolledHP) {
    hitDieValue = data.rolledHP;
  } else {
    // Default to max for level 1
    hitDieValue = classData.hit_die;
  }
  // Calculate HP with species bonuses (data-driven)
  const hpBonus = (speciesData.mechanicalBonuses?.hpPerLevel || 0) * level;
  const maxHitPoints = hitDieValue + finalAbilities.CON.modifier + hpBonus;

  // 3. Calculate Skills (from selected skills + background skills)
  const backgroundData = BACKGROUNDS.find(bg => bg.name === data.background);
  const backgroundSkills = backgroundData?.skill_proficiencies || [];
  const allProficientSkills = [...data.selectedSkills, ...backgroundSkills.map(s => s as SkillName)];

  const finalSkills: Character['skills'] = {} as Character['skills'];
  ALL_SKILLS.forEach((skillName) => {
    const ability = SKILL_TO_ABILITY[skillName];
    const modifier = finalAbilities[ability].modifier;
    const isProficient = allProficientSkills.includes(skillName);

    finalSkills[skillName] = {
      proficient: isProficient,
      value: modifier + (isProficient ? pb : 0),
    };
  });

  // 4. Calculate Spellcasting Stats (if applicable)
  let spellcastingData: Character['spellcasting'] = undefined;
  if (classData.spellcasting) {
    spellcastingData = initializeSpellcasting(
      data.classSlug,
      level,
      {
        STR: finalAbilities.STR.score,
        DEX: finalAbilities.DEX.score,
        CON: finalAbilities.CON.score,
        INT: finalAbilities.INT.score,
        WIS: finalAbilities.WIS.score,
        CHA: finalAbilities.CHA.score,
      }
    );
  }

  // 5. Build Equipment Inventory (using Builder Pattern for reduced complexity)
  const { inventory, equippedArmor, equippedWeapons } = processEquipment(data, level);
  const equipmentPackage = EQUIPMENT_PACKAGES.find(pkg => pkg.level === level) || EQUIPMENT_PACKAGES[0];

  // 6. Calculate AC based on equipped armor (using centralized helper)
  let armorClass = BASE_ARMOR_CLASS + finalAbilities.DEX.modifier; // Default unarmored
  if (equippedArmor) {
    const armor = loadEquipment().find(eq => eq.slug === equippedArmor);
    if (armor?.armor_class && armor.armor_category) {
      armorClass = calculateArmorClassByCategory(
        armor.armor_category as ArmorCategory,
        armor.armor_class.base,
        finalAbilities.DEX.modifier,
        armor.armor_class.max_bonus,
        armorClass
      );
    }
  }

  // 7. Load Class Features from SRD (Sprint 5)
  const classFeatures = getFeaturesByClass(data.classSlug, level);

  // 8. Load Subclass Features from SRD (Sprint 5)
  let subclassFeatures: typeof classFeatures = [];
  if (data.subclassSlug) {
    subclassFeatures = getFeaturesBySubclass(data.classSlug, data.subclassSlug, level);
  }

  // 9. Build complete class features list (Sprint 5)
  // Include Fighting Style if selected
  const allClassFeatures = [...classData.class_features];
  if (data.selectedFightingStyle) {
    allClassFeatures.push(`Fighting Style: ${data.selectedFightingStyle}`);
  }

  // 10. Calculate Known Languages
  const knownLanguages = calculateKnownLanguages(data);

  // 11. Construct Final Character Object
  return {
    id: generateUUID(), // Generate UUID for IndexedDB
    name: data.name || DEFAULT_CHARACTER_NAME,
    species: speciesData.name,
    class: classData.name,
    subclass: data.subclassSlug, // Sprint 5: Store subclass slug
    level,
    alignment: data.alignment,
    background: data.background,
    edition: data.edition,
    languages: knownLanguages,
    inspiration: false,
    proficiencyBonus: pb,
    armorClass,
    hitPoints: maxHitPoints,
    maxHitPoints,
      hitDice: {
        current: data.level,
        max: data.level,
        dieType: getHitDieForClass(data.classSlug),
      },
    speed: speciesData.baseSpeed || DEFAULT_WALKING_SPEED,
    initiative: finalAbilities.DEX.modifier,
    abilities: finalAbilities,
    skills: finalSkills,
    featuresAndTraits: {
      personality: data.personality,
      ideals: data.ideals,
      bonds: data.bonds,
      flaws: data.flaws,
      classFeatures: allClassFeatures, // Includes fighting style if applicable
      speciesTraits: speciesData.species_traits,
      backgroundFeatures: [],
      musicalInstrumentProficiencies: [],
    },
    spellcasting: spellcastingData, // Sprint 2: Include spell data
    // Sprint 4: Equipment and inventory
    inventory,
    currency: {
      ...DEFAULT_STARTING_CURRENCY,
      gp: equipmentPackage?.startingGold || 0,
    },
    equippedArmor,
    equippedWeapons,
    selectedFightingStyle: data.selectedFightingStyle, // Sprint 5: Store fighting style
    // Sprint 5: Store SRD features and selected feats
    srdFeatures: {
      classFeatures: classFeatures.map(f => ({ name: f.name, slug: f.slug, level: f.level, source: 'class' as const })),
      subclassFeatures: subclassFeatures.map(f => ({ name: f.name, slug: f.slug, level: f.level, source: 'subclass' as const })),
    },
    selectedFeats: data.selectedFeats || [],
  };
};
