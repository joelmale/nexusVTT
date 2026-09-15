import { CharacterCreationData, Character, AbilityName, SkillName } from '../types/dnd';
import { getAllSpecies, loadClasses, BACKGROUNDS, PROFICIENCY_BONUSES, getModifier, SKILL_TO_ABILITY, ALL_SKILLS, getHitDieForClass } from '../services/dataService';
import { migrateSpellSelectionToCharacter } from '../utils/spellUtils';
import { addItemToInventoryByName } from '../utils/equipmentMatching';
import { BASE_ARMOR_CLASS } from '../constants/combat';
import { log } from './logger';

/**
 * Calculate final character stats from character creation data
 */
export const calculateCharacterStats = (data: CharacterCreationData): Character => {
  const speciesData = getAllSpecies().find(s => s.slug === data.speciesSlug);
  const classData = loadClasses().find(c => c.slug === data.classSlug);
  const backgroundData = BACKGROUNDS.find(bg => bg.slug === data.background); // Fetch background data here

  log.debug('Character creation data lookup', {
    species: speciesData ? { name: speciesData.name, slug: speciesData.slug } : null,
    class: classData ? { name: classData.name, slug: classData.slug } : null,
    background: backgroundData ? { name: backgroundData.name, slug: backgroundData.slug } : null,
  });

  if (!speciesData || !classData || !backgroundData) {
    log.error('Character creation missing required data', {
      speciesSlug: data.speciesSlug,
      classSlug: data.classSlug,
      backgroundSlug: data.background
    });
    throw new Error("Incomplete creation data.");
  }

  const finalAbilities: Character['abilities'] = {} as Character['abilities'];

  // 1. Calculate Abilities with Bonuses
  (Object.keys(data.abilities) as AbilityName[]).forEach((ability) => {
    let rawScore = data.abilities[ability];

    if (data.edition === '2014') {
      // 2014: Apply Species Ability Bonuses
      rawScore += (speciesData.ability_bonuses?.[ability] || 0);
    } else if (data.edition === '2024') {
      // 2024: Apply Background Ability Bonuses
      // Fixed bonuses first
      rawScore += (backgroundData.abilityScores?.fixed?.[ability] || 0);
      // Then chosen options (assuming `data.abilities` already includes chosen options from wizard step)
      // This part might need further refinement based on how the wizard handles chosen background ASIs
      // For now, we assume rawScore already contains the chosen +1/+2
    }

    // Apply cumulative ASI increases for high-level characters
    if (data.cumulativeASI) {
      data.cumulativeASI.forEach(asiChoice => {
        if (asiChoice.type === 'asi' && asiChoice.asiAllocations) {
          rawScore += asiChoice.asiAllocations[ability] || 0;
        }
      });
    }

    const modifier = getModifier(rawScore);
    finalAbilities[ability] = { score: rawScore, modifier };
  });


  const level = data.level;
  const pb = PROFICIENCY_BONUSES[level - 1] || 2;

  // 2. Calculate Hit Points (Based on chosen method)
  let maxHitPoints: number;

  if (level === 1) {
    // Level 1: Full hit die + CON modifier
    let hitDieValue: number;
    if (data.hpCalculationMethod === 'rolled' && data.rolledHP) {
      hitDieValue = data.rolledHP;
    } else {

      // Default to max for level 1
      hitDieValue = classData.hit_die;
    }

    maxHitPoints = hitDieValue + finalAbilities.CON.modifier;
  } else if (data.highLevelSetup) {

    // Use high-level setup HP if available
    maxHitPoints = data.highLevelSetup.totalHP;
  } else {

    // Fallback: Multi-level calculation using average HP
    const conModifier = finalAbilities.CON.modifier;
    const hitDie = classData.hit_die;

    // Level 1: Full hit die + CON
    let totalHP = hitDie + conModifier;

    // Levels 2+: Average HP per level + CON
    const avgHPPerLevel = Math.floor(hitDie / 2) + 1 + conModifier;
    totalHP += avgHPPerLevel * (level - 1);

    maxHitPoints = totalHP;
  }


  // Add racial bonuses (like Dwarf toughness)
  maxHitPoints += (speciesData.slug === 'dwarf' ? level : 0);

  // 3. Calculate Skills (from selected skills + background skills + expertise)
  const backgroundSkills = backgroundData?.skill_proficiencies || [];
  const allProficientSkills = [...data.selectedSkills, ...backgroundSkills.map(s => s as SkillName)];

  const finalSkills: Character['skills'] = {} as Character['skills'];
  ALL_SKILLS.forEach((skillName) => {
    const ability = SKILL_TO_ABILITY[skillName];
    const modifier = finalAbilities[ability].modifier;
    const isProficient = allProficientSkills.includes(skillName);
    const hasExpertise = data.expertiseSkills?.includes(skillName) || false;

    // Expertise applies 2x proficiency bonus
    let skillBonus = 0;
    if (isProficient) {
      skillBonus = hasExpertise ? (pb * 2) : pb;
    }


    finalSkills[skillName] = {
      proficient: isProficient,
      value: modifier + skillBonus,
    };

  });


  // 3.5. Calculate Inventory from Equipment Choices
  const inventory: Character['inventory'] = [];

  // Add items from class equipment choices
  if (data.equipmentChoices) {
    data.equipmentChoices.forEach(choice => {
      if (choice.selected !== null && choice.selected !== undefined) {
        const selectedBundle = choice.options[choice.selected];
        selectedBundle.forEach(item => {
          // Use the equipment matching utility to find and add items
          const results = addItemToInventoryByName(item.name, item.quantity);

          // Process each result (can be multiple if pack expanded)
          results.forEach(result => {
            // Check if item already exists in inventory
            const existingItem = inventory.find(inv => inv.equipmentSlug === result.equipmentSlug);
            if (existingItem) {
              existingItem.quantity += result.quantity;
            } else {

              inventory.push({
                equipmentSlug: result.equipmentSlug,
                quantity: result.quantity,
                equipped: false, // Will be equipped manually by player
              });

            }

          });

        });

      }

    });

  }

  // Add background equipment
  if (backgroundData?.equipment) {
    const backgroundEquipment = Array.isArray(backgroundData.equipment)
      ? backgroundData.equipment
      : [backgroundData.equipment];
    
    backgroundEquipment.forEach(itemName => {
      // Try to match the background equipment name to equipment database
      const results = addItemToInventoryByName(itemName, 1);
      
      // Process each result (can be multiple if pack expanded)
      results.forEach(result => {
          // Check if item already exists in inventory
          const existingItem = inventory.find(inv => inv.equipmentSlug === result.equipmentSlug);
          if (existingItem) {
            existingItem.quantity += result.quantity;
          } else {
            inventory.push({
              equipmentSlug: result.equipmentSlug,
              quantity: result.quantity,
              equipped: false,
            });
          }      });
    });
  }

  // Add trinket to inventory
  if (data.selectedTrinket) {
    inventory.push({
      equipmentSlug: `trinket-${data.selectedTrinket.roll}`,
      quantity: 1,
      equipped: false,
      trinket: data.selectedTrinket,
    });
  }


  // Add custom starting inventory from equipment browser
  if (data.startingInventory) {
    data.startingInventory.forEach(item => {
      // Check if item already exists in inventory
      const existingItem = inventory.find(inv => inv.equipmentSlug === item.equipmentSlug);
      if (existingItem) {
        existingItem.quantity += item.quantity;
      } else {

        inventory.push({
          equipmentSlug: item.equipmentSlug,
          quantity: item.quantity,
          equipped: item.equipped || false,
        });

      }

    });

  }


  // 4. Calculate Spellcasting Stats (if applicable)
  let spellcastingData: Character['spellcasting'] = undefined;
  if (classData.spellcasting) {
    spellcastingData = migrateSpellSelectionToCharacter(
      data.spellSelection,
      classData,
      Object.fromEntries(
        Object.entries(finalAbilities).map(([key, value]) => [key, value.score])
      ) as Record<string, number>,
      level
    );
  }


  // 5. Apply lineage effects (traits/spells/speed overrides)
  const lineageData = data.selectedLineage && 'lineages' in speciesData
    ? (speciesData as { lineages?: Record<string, { traits?: Character['featuresAndTraits']['speciesTraits']; baseSpeed?: number }> }).lineages?.[data.selectedLineage]
    : undefined;

  const mergedTraits = [
    ...(speciesData.species_traits || []),
    ...(lineageData?.traits || []),
  ];

  // Future: apply lineage spells if we surface them in spell lists

  const effectiveSpeed = lineageData?.baseSpeed || speciesData.speed || 30;

  // 6. Calculate Armor Class (simple calculation)
  const armorClass = BASE_ARMOR_CLASS + finalAbilities.DEX.modifier;

  // 7. Calculate Initiative
  const initiative = finalAbilities.DEX.modifier;

  // 8. Load Features and Traits
  const featuresAndTraits: Character['featuresAndTraits'] = {
    personality: data.personality || '',
    ideals: data.ideals || '',
    bonds: data.bonds || '',
    flaws: data.flaws || '',
    classFeatures: classData.class_features || [],
    speciesTraits: mergedTraits,
    backgroundFeatures: backgroundData ? [{
      name: backgroundData.feature || 'Background Feature',
      description: backgroundData.feature_description || 'A feature from your background.'
    }] : [],
    musicalInstrumentProficiencies: data.selectedMusicalInstruments || [],
  };


  // 9. Calculate SRD Features (from the original implementation)
  const srdFeatures = {
    classFeatures: [], // Would need to be populated from SRD data
    subclassFeatures: [],
  };


  // 10. Create final character object
  // Collect all feats (level 1 + cumulative ASI feats)
  const allFeats = [...(data.selectedFeats || [])];
  
  // Add 2024 Background Origin Feat
  if (data.edition === '2024' && backgroundData?.originFeat) {
    allFeats.push(backgroundData.originFeat);
  }

   // Add 2024 Human Bonus Origin Feat
   if (data.edition === '2024' && data.humanOriginFeat) {
     allFeats.push(data.humanOriginFeat);
   }

  // Add 2024 Species Feat
  if (data.edition === '2024' && data.speciesFeat) {
    allFeats.push(data.speciesFeat);
  }

  // Add 2024 Human Versatile extra feat
  if (data.edition === '2024' && data.speciesSlug === 'human-2024' && data.humanVersatileFeat) {
    allFeats.push(data.humanVersatileFeat);
  }

  if (data.cumulativeASI) {
    data.cumulativeASI.forEach(asiChoice => {
      if (asiChoice.type === 'feat' && asiChoice.featSlug) {
        allFeats.push(asiChoice.featSlug);
      }
    });
  }


  const character: Character = {
    id: '', // Will be set when saving
    name: data.name,
    species: speciesData.name,
    class: classData.name,
    classSlug: classData.slug,
    level,
    alignment: data.alignment,
    background: data.background,
    edition: data.edition,
    inspiration: false,
    proficiencyBonus: pb,
    armorClass,
    hitPoints: maxHitPoints, // Current hit points
    maxHitPoints,
    hitDice: {
      current: level,
      max: level,
      dieType: getHitDieForClass(data.classSlug),
    },

    speed: effectiveSpeed,
    initiative,
    abilities: finalAbilities,
    skills: finalSkills,
    languages: data.knownLanguages,
    featuresAndTraits,
    proficiencies: {
      armor: classData.proficiencies?.armor || [],
      weapons: classData.proficiencies?.weapons || [],
      tools: Array.from(new Set([...(classData.proficiencies?.tools || []), ...(backgroundData.tool_proficiencies || [])])),
    },
     selectedFeats: allFeats,
     spellcasting: spellcastingData,
     srdFeatures,
     subclass: data.subclassSlug,
     experiencePoints: 0,
     feats: allFeats, // Legacy support
     selectedFightingStyle: data.selectedFightingStyle,
     inventory,
     trinket: data.selectedTrinket,
     expertiseSkills: data.expertiseSkills,
     weaponMastery: data.weaponMastery,
     divineOrder: data.divineOrder,
     primalOrder: data.primalOrder,
     fightingStyle: data.fightingStyle,
     eldritchInvocations: data.eldritchInvocations,
     originFeat: backgroundData?.originFeat, // 2024 Origin Feat reference
    currency: {
      cp: 0,
      sp: 0,
      gp: 0,
      pp: 0,
    },

    equippedArmor: undefined,
    equippedWeapons: [],
    temporaryHitPoints: 0,
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };


  return character;
};
