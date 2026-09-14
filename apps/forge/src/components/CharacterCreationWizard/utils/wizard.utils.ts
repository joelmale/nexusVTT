import { CharacterCreationData, Character, AbilityName, SkillName, EquippedItem } from '../../../types/dnd';
import { getAllSpecies, loadClasses, loadEquipment, getFeaturesByClass, getFeaturesBySubclass, PROFICIENCY_BONUSES, ALL_SKILLS, SKILL_TO_ABILITY, BACKGROUNDS, EQUIPMENT_PACKAGES, getModifier, getHitDieForClass } from '../../../services/dataService';
import { migrateSpellSelectionToCharacter } from '../../../utils/spellUtils';
import { generateUUID } from '../../../services/diceService';
import { calculateKnownLanguages } from '../../../utils/languageUtils';

export const calculateCharacterStats = (data: CharacterCreationData): Character => {
  const speciesData = getAllSpecies().find(s => s.slug === data.speciesSlug);
  const classData = loadClasses(data.edition).find(c => c.slug === data.classSlug);

  if (!speciesData || !classData) {
    throw new Error("Incomplete creation data.");
  }

  const finalAbilities: Character['abilities'] = {} as Character['abilities'];

  // 1. Calculate Abilities with Racial Bonuses
  (Object.keys(data.abilities) as AbilityName[]).forEach((ability) => {
    let racialBonus = speciesData.ability_bonuses?.[ability] || 0;

    // Handle variant human ability bonuses
    if (speciesData.slug === 'human' && data.selectedSpeciesVariant === 'variant' && data.variantAbilityBonuses) {
      racialBonus = data.variantAbilityBonuses[ability] || 0;
    }

    const rawScore = data.abilities[ability] + racialBonus;
    const modifier = getModifier(rawScore);
    finalAbilities[ability] = { score: rawScore, modifier };
  });

  const level = data.level;
  const pb = PROFICIENCY_BONUSES[level - 1] || 2;

  // 2. Calculate Hit Points (Based on chosen method)
  let hitDieValue: number;
  if (data.hpCalculationMethod === 'rolled' && data.rolledHP) {
    hitDieValue = data.rolledHP;
  } else {
    // Default to max for level 1
    hitDieValue = classData.hit_die;
  }
  const maxHitPoints = hitDieValue + finalAbilities.CON.modifier + (speciesData.slug === 'dwarf' ? level : 0);

  // 3. Calculate Skills (from selected skills + background skills + variant skills)
    const backgroundData = BACKGROUNDS.find(bg => bg.name === data.background);
    const backgroundSkills = backgroundData?.skill_proficiencies || [];

    // Add variant human skill proficiency
    const variantSkills = data.selectedSpeciesVariant === 'variant' && data.variantSkillProficiency
      ? [data.variantSkillProficiency]
      : [];

    const allProficientSkills = [
      ...data.selectedSkills,
      ...backgroundSkills.map(s => s as SkillName),
      ...variantSkills
    ];

  const finalSkills: Character['skills'] = {} as Character['skills'];
  ALL_SKILLS.forEach((skillName) => {
    const ability = SKILL_TO_ABILITY[skillName];
    const modifier = finalAbilities[ability].modifier;
    const isProficient = allProficientSkills.includes(skillName);

    // Check if skill has expertise (doubles proficiency bonus)
    const hasExpertise = data.expertiseSkills?.includes(skillName) ?? false;

    // Calculate skill value: modifier + proficiency (or double proficiency for expertise)
    let skillValue = modifier;
    if (isProficient) {
      skillValue += hasExpertise ? pb * 2 : pb;
    }

    // 2024 Cleric Thaumaturge adds WIS modifier to Arcana and Religion
    if (data.classSlug === 'cleric' && data.edition === '2024' && data.divineOrder === 'thaumaturge') {
      if (skillName === 'Arcana' || skillName === 'Religion') {
        skillValue += finalAbilities.WIS.modifier;
      }
    }

    // 2024 Druid Magician adds WIS modifier to Arcana and Nature
    if (data.classSlug === 'druid' && data.edition === '2024' && data.primalOrder === 'magician') {
      if (skillName === 'Arcana' || skillName === 'Nature') {
        skillValue += finalAbilities.WIS.modifier;
      }
    }

    finalSkills[skillName] = {
      proficient: isProficient,
      value: skillValue,
      expertise: hasExpertise, // Store expertise flag for character sheet display
    };
  });

  // 4. Calculate Spellcasting Stats (if applicable)
  let spellcastingData: Character['spellcasting'] = undefined;
  if (classData.spellcasting) {
    spellcastingData = migrateSpellSelectionToCharacter(
      data.spellSelection,
      classData,
      {
        STR: finalAbilities.STR.score,
        DEX: finalAbilities.DEX.score,
        CON: finalAbilities.CON.score,
        INT: finalAbilities.INT.score,
        WIS: finalAbilities.WIS.score,
        CHA: finalAbilities.CHA.score,
      },
      level
    );
  }

  // 5. Build Equipment Inventory
  const inventory: EquippedItem[] = [];
  let equippedArmor: string | undefined;
  const equippedWeapons: string[] = [];

  // Get equipment package for the character's level
  const equipmentPackage = EQUIPMENT_PACKAGES.find(pkg => pkg.level === level) || EQUIPMENT_PACKAGES[0];

  // Add items from equipment package
  equipmentPackage.items.forEach(item => {
    const itemSlug = item.slug || item.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    inventory.push({
      equipmentSlug: itemSlug,
      quantity: item.quantity,
      equipped: item.equipped || false,
    });

    // Track equipped items
    const equipment = loadEquipment().find(eq => eq.slug === itemSlug);
    if (item.equipped && equipment) {
      if (equipment.armor_category) {
        equippedArmor = itemSlug;
      } else if (equipment.weapon_category) {
        equippedWeapons.push(itemSlug);
      }
    }
  });

  // Add items from class equipment choices
  data.equipmentChoices.forEach(choice => {
    if (choice.selected !== null) {
      const selectedBundle = choice.options[choice.selected];
      selectedBundle.forEach(item => {
        // Try to find matching equipment in database
        const equipmentSlug = item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const foundEquipment = loadEquipment().find(eq =>
          eq.slug === equipmentSlug || eq.name.toLowerCase() === item.name.toLowerCase()
        );

        if (foundEquipment) {
          inventory.push({
            equipmentSlug: foundEquipment.slug,
            quantity: item.quantity,
            equipped: false, // Will be equipped manually by player
          });
        }
      });
    }
  });

  // Add custom starting inventory from equipment browser (Sprint 4)
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

    // Process equipped items from startingInventory to update equippedArmor/equippedWeapons
    data.startingInventory.forEach(item => {
      if (item.equipped) {
        const equipment = loadEquipment().find(eq => eq.slug === item.equipmentSlug);
        if (equipment) {
          if (equipment.armor_category) {
            equippedArmor = item.equipmentSlug;
          } else if (equipment.weapon_category) {
            equippedWeapons.push(item.equipmentSlug);
          }
        }
      }
    });
  }

  // 6. Calculate AC based on equipped armor
  let armorClass = 10 + finalAbilities.DEX.modifier; // Default unarmored
  if (equippedArmor) {
    const armor = loadEquipment().find(eq => eq.slug === equippedArmor);
    if (armor?.armor_class) {
      if (armor.armor_category === 'Light') {
        // Light armor: base + full DEX
        armorClass = armor.armor_class.base + finalAbilities.DEX.modifier;
      } else if (armor.armor_category === 'Medium') {
        // Medium armor: base + DEX (max +2)
        const dexBonus = Math.min(finalAbilities.DEX.modifier, armor.armor_class.max_bonus || 2);
        armorClass = armor.armor_class.base + dexBonus;
      } else if (armor.armor_category === 'Heavy') {
        // Heavy armor: base only
        armorClass = armor.armor_class.base;
      } else if (armor.armor_category === 'Shield') {
        // Shield adds +2 to current AC
        armorClass += 2;
      }
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

  // Add Divine Order for 2024 Cleric
  if (data.classSlug === 'cleric' && data.edition === '2024' && data.divineOrder) {
    if (data.divineOrder === 'protector') {
      allClassFeatures.push('Divine Order: Protector (Heavy Armor & Martial Weapons proficiency)');
    } else if (data.divineOrder === 'thaumaturge') {
      allClassFeatures.push('Divine Order: Thaumaturge (+1 Cantrip, WIS to Arcana & Religion checks)');
    }
  }

  // 10. Calculate Known Languages
  const knownLanguages = calculateKnownLanguages(data);

  // 11. Calculate Proficiencies (including Divine Order bonuses)
  const proficiencies: Character['proficiencies'] = {
    armor: [],
    weapons: [],
    tools: []
  };

  // Add base class proficiencies from class data
  // (This would ideally come from classData.proficiencies, but for now we handle Divine Order)

  // 2024 Cleric Protector gets Heavy Armor and Martial Weapons
  if (data.classSlug === 'cleric' && data.edition === '2024' && data.divineOrder === 'protector') {
    proficiencies.armor?.push('Heavy Armor');
    proficiencies.weapons?.push('Martial Weapons');
  }

  // 12. Construct Final Character Object
  return {
    id: generateUUID(), // Generate UUID for IndexedDB
    name: data.name || "Unnamed Hero",
    edition: data.edition, // Store edition (2014 or 2024)
    species: speciesData.name,
    class: classData.name,
    subclass: data.subclassSlug, // Sprint 5: Store subclass slug
    level,
    alignment: data.alignment,
    background: data.background,
    languages: knownLanguages,
    inspiration: false,
    proficiencyBonus: pb,
    armorClass,
    hitPoints: maxHitPoints,
    maxHitPoints,
    hitDice: {
      current: level,
      max: level,
      dieType: getHitDieForClass(data.classSlug),
    },
    speed: 30,
    initiative: finalAbilities.DEX.modifier,
    abilities: finalAbilities,
    skills: finalSkills,
    proficiencies,
    featuresAndTraits: {
      personality: data.personality,
      ideals: data.ideals,
      bonds: data.bonds,
      flaws: data.flaws,
      classFeatures: allClassFeatures, // Includes fighting style if applicable
      speciesTraits: speciesData.species_traits,
      backgroundFeatures: backgroundData?.feature
        ? [{ name: backgroundData.feature, description: backgroundData.feature_description || '' }]
        : [],
      musicalInstrumentProficiencies: data.selectedMusicalInstruments,
    },
    spellcasting: spellcastingData, // Sprint 2: Include spell data
    // Sprint 4: Equipment and inventory
    inventory,
    currency: {
      cp: 0,
      sp: 0,
      gp: equipmentPackage.startingGold || 0,
      pp: 0,
    },
    equippedArmor,
    equippedWeapons,
    selectedFightingStyle: data.selectedFightingStyle, // Sprint 5: Store fighting style
    // Sprint 5: Store SRD features and selected feats
    srdFeatures: {
      classFeatures: classFeatures.map(f => ({ name: f.name, slug: f.slug, level: f.level, source: 'class' as const })),
      subclassFeatures: subclassFeatures.map(f => ({ name: f.name, slug: f.slug, level: f.level, source: 'subclass' as const })),
    },
    selectedFeats: [
      ...(data.selectedFeats || []),
      ...(data.selectedSpeciesVariant === 'variant' && data.variantFeat ? [data.variantFeat] : [])
    ],
    // Race variant information
    selectedSpeciesVariant: data.selectedSpeciesVariant,
    // 2024 Level 1 Feature Choices
    divineOrder: data.divineOrder, // 2024 Cleric Divine Order choice
    primalOrder: data.primalOrder, // 2024 Druid Primal Order choice
    pactBoon: data.pactBoon, // 2024 Warlock Pact Boon choice
    expertiseSkills: data.expertiseSkills, // Rogue, Ranger, Bard: Skills/tools with double proficiency
    weaponMastery: data.weaponMastery, // Rogue, Fighter, Barbarian, Paladin: Mastered weapon slugs
    fightingStyle: data.fightingStyle, // Fighter, Paladin, Ranger: Fighting Style slug
    eldritchInvocations: data.eldritchInvocations, // 2024 Warlock: Eldritch Invocations
    secondWindUses: data.secondWindUses, // 2024 Fighter: Second Wind uses remaining
    backgroundFeat: data.backgroundFeat, // 2024 Origin Feat from background
  };
};

export const formatModifier = (mod: number): string => mod >= 0 ? `+${mod}` : `${mod}`;
