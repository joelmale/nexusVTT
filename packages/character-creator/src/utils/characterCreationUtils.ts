import {
  CharacterCreationData,
  Character,
  AbilityName,
  SkillName,
} from '../types/dnd';
import {
  getAllSpecies,
  loadClasses,
  loadEquipment,
  BACKGROUNDS,
  PROFICIENCY_BONUSES,
  getModifier,
  SKILL_TO_ABILITY,
  ALL_SKILLS,
  getHitDieForClass,
  FEAT_DATABASE,
} from '../services/dataService';
import { migrateSpellSelectionToCharacter } from '../utils/spellUtils';
import { resolveLoadout } from '../services/loadoutResolver';
import { resolveCastingGrants } from '../services/castingSources';
import { choiceId, humanOriginFeat } from '../services/originChoices';
import { BASE_ARMOR_CLASS } from '../constants/combat';
import { grantedFeatProficiencies } from '../services/featProficiencies';
import { log } from './logger';

/**
 * Calculate final character stats from character creation data
 */
export const calculateCharacterStats = (
  data: CharacterCreationData,
): Character => {
  data = {
    ...data,
    selectedLineage: data.selectedLineage
      ? choiceId(data.selectedLineage)
      : undefined,
  };
  if (data.edition === '2024' && data.speciesSlug === 'human-2024')
    data = {
      ...data,
      humanOriginFeat: humanOriginFeat(data),
      humanVersatileFeat: undefined,
      speciesFeat: undefined,
    };
  const edition = data.edition || '2024';
  const speciesData =
    getAllSpecies(edition).find(
      (s) =>
        s.slug === data.speciesSlug ||
        (s.legacySlugs && s.legacySlugs.includes(data.speciesSlug)) ||
        s.name.toLowerCase() === data.speciesSlug?.toLowerCase(),
    ) ||
    getAllSpecies().find(
      (s) =>
        s.slug === data.speciesSlug ||
        (s.legacySlugs && s.legacySlugs.includes(data.speciesSlug)) ||
        s.name.toLowerCase() === data.speciesSlug?.toLowerCase(),
    );
  const classData =
    loadClasses(edition).find((c) => c.slug === data.classSlug) ||
    loadClasses().find((c) => c.slug === data.classSlug);
  const backgroundData = BACKGROUNDS.find(
    (bg) =>
      bg.edition === edition &&
      (bg.slug === data.background ||
        bg.slug === `${data.background}-${edition}` ||
        bg.name.toLowerCase() === data.background?.toLowerCase()),
  );

  log.debug('Character creation data lookup', {
    species: speciesData
      ? { name: speciesData.name, slug: speciesData.slug }
      : null,
    class: classData ? { name: classData.name, slug: classData.slug } : null,
    background: backgroundData
      ? { name: backgroundData.name, slug: backgroundData.slug }
      : null,
  });

  if (!speciesData || !classData || !backgroundData) {
    log.error('Character creation missing required data', {
      speciesSlug: data.speciesSlug,
      classSlug: data.classSlug,
      backgroundSlug: data.background,
    });
    throw new Error('Incomplete creation data.');
  }

  const finalAbilities: Character['abilities'] = {} as Character['abilities'];

  const SUBRACE_BONUSES_2014: Record<
    string,
    Partial<Record<AbilityName, number>>
  > = {
    'high-elf': { INT: 1 },
    'wood-elf': { WIS: 1 },
    drow: { CHA: 1 },
    'dark-elf': { CHA: 1 },
    'hill-dwarf': { WIS: 1 },
    'mountain-dwarf': { STR: 2 },
    'lightfoot-halfling': { CHA: 1 },
    lightfoot: { CHA: 1 },
    'stout-halfling': { CON: 1 },
    stout: { CON: 1 },
    'forest-gnome': { DEX: 1 },
    'rock-gnome': { CON: 1 },
  };

  // 1. Calculate Abilities with Bonuses
  (Object.keys(data.abilities) as AbilityName[]).forEach((ability) => {
    let rawScore = data.abilities[ability];

    if (data.edition === '2014') {
      // 2014: Apply Species Ability Bonuses
      if (
        speciesData.slug === 'human' &&
        (data.selectedSpeciesVariant ?? data.variantSlug ?? 'standard') ===
          'standard'
      ) {
        rawScore += 1;
      } else if (
        speciesData.slug === 'human' &&
        (data.selectedSpeciesVariant ?? data.variantSlug) === 'variant'
      ) {
        rawScore += data.variantAbilityBonuses?.[ability] ?? 0;
      } else {
        rawScore += speciesData.ability_bonuses?.[ability] || 0;
        const subraceKey =
          data.selectedLineage ||
          data.selectedSpeciesVariant ||
          data.variantSlug;
        if (subraceKey && SUBRACE_BONUSES_2014[subraceKey]?.[ability]) {
          rawScore += SUBRACE_BONUSES_2014[subraceKey]![ability]!;
        }
      }
    } else if (data.edition === '2024') {
      // 2024: Apply Background Ability Bonuses
      if (data.backgroundAbilityChoices?.bonuses?.[ability]) {
        rawScore += data.backgroundAbilityChoices.bonuses[ability]!;
      } else if (backgroundData.abilityScores?.fixed?.[ability]) {
        rawScore += backgroundData.abilityScores.fixed[ability]!;
      }
    }

    // Apply cumulative ASI increases for high-level characters
    if (data.cumulativeASI) {
      data.cumulativeASI.forEach((asiChoice) => {
        if (asiChoice.type === 'asi' && asiChoice.asiAllocations) {
          rawScore += asiChoice.asiAllocations[ability] || 0;
        }
      });
    }

    const featSlugs = [
      ...new Set([
        ...(data.selectedFeats ?? []),
        ...(data.variantFeat ? [data.variantFeat] : []),
        ...(data.cumulativeASI ?? []).flatMap((choice) =>
          choice.type === 'feat' && choice.featSlug ? [choice.featSlug] : [],
        ),
      ]),
    ];
    for (const slug of featSlugs) {
      const increase = FEAT_DATABASE.find(
        (feat) => feat.slug === slug,
      )?.abilityScoreIncrease;
      if (!increase) continue;
      const selected =
        data.featChoices?.[slug]?.abilityChoice ??
        (increase.options.length === 1 ? increase.options[0] : undefined);
      if (selected === ability && increase.options.includes(ability))
        rawScore = Math.min(20, rawScore + increase.amount);
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
  maxHitPoints +=
    (edition === '2024' && speciesData.slug.includes('dwarf')) ||
    (edition === '2014' &&
      (data.selectedLineage === 'hill-dwarf' ||
        data.selectedSpeciesVariant === 'hill-dwarf'))
      ? level
      : 0;

  // Tough feat: adds 2 HP per level
  const hasTough =
    backgroundData?.originFeat === 'tough' ||
    data.variantFeat === 'tough' ||
    data.cumulativeASI?.some(
      (choice) => choice.type === 'feat' && choice.featSlug === 'tough',
    ) ||
    data.originFeat === 'tough' ||
    data.speciesFeat === 'tough' ||
    data.humanOriginFeat === 'tough' ||
    data.humanVersatileFeat === 'tough' ||
    (data.selectedFeats && data.selectedFeats.includes('tough'));
  if (hasTough) {
    maxHitPoints += level * 2;
  }

  // 3. Calculate Skills (from selected skills + background skills + expertise)
  const backgroundSkills = backgroundData?.skill_proficiencies || [];
  const selectedSkills =
    data.selectedSkills ||
    (data as unknown as { skills?: SkillName[] }).skills ||
    [];
  const speciesSkills =
    edition === '2014' && speciesData.slug.includes('elf')
      ? ['Perception']
      : data.speciesSkillProficiency
        ? [data.speciesSkillProficiency]
        : [];
  const normalizeSkill = (value: string) =>
    value.toLowerCase().replace(/[^a-z]/g, '');
  const allProficientSkills = [
    ...grantedFeatProficiencies(data),
    ...selectedSkills,
    ...backgroundSkills,
    ...speciesSkills,
    ...(edition === '2014' &&
    data.speciesSlug === 'human' &&
    data.variantSkillProficiency
      ? [data.variantSkillProficiency]
      : []),
    ...(data.overflowSkills ?? []),
  ].map(normalizeSkill);

  const finalSkills: Character['skills'] = {} as Character['skills'];
  ALL_SKILLS.forEach((skillName) => {
    const ability = SKILL_TO_ABILITY[skillName];
    const modifier = finalAbilities[ability].modifier;
    const isProficient = allProficientSkills.includes(
      normalizeSkill(skillName),
    );
    const hasExpertise =
      isProficient &&
      (data.expertiseSkills?.some(
        (value) => normalizeSkill(value) === normalizeSkill(skillName),
      ) ||
        false);

    // Expertise applies 2x proficiency bonus
    let skillBonus = 0;
    if (isProficient) {
      skillBonus = hasExpertise ? pb * 2 : pb;
    }

    finalSkills[skillName] = {
      proficient: isProficient,
      expertise: hasExpertise,
      value: modifier + skillBonus,
    };
    if (
      edition === '2024' &&
      ((data.classSlug === 'cleric' &&
        data.divineOrder === 'thaumaturge' &&
        ['Arcana', 'Religion'].includes(skillName)) ||
        (data.classSlug === 'druid' &&
          data.primalOrder === 'magician' &&
          ['Arcana', 'Nature'].includes(skillName)))
    )
      finalSkills[skillName].value += Math.max(1, finalAbilities.WIS.modifier);
  });

  // Inventory and wallet are resolved together, once. Derived stats never add grants.
  const loadout = resolveLoadout(data);
  const inventory: NonNullable<Character['inventory']> = loadout.items.map(
    (item) => ({
      equipmentSlug: item.slug,
      quantity: item.quantity,
      equipped: item.equipped,
    }),
  );
  const currency = loadout.currency;
  if (data.selectedTrinket)
    inventory.push({
      equipmentSlug: `trinket-${data.selectedTrinket.roll}`,
      quantity: 1,
      equipped: false,
      trinket: data.selectedTrinket,
    });

  // 4. Calculate Spellcasting Stats (if applicable)
  let spellcastingData: Character['spellcasting'] = undefined;
  if (classData.spellcasting) {
    spellcastingData = migrateSpellSelectionToCharacter(
      data.spellSelection,
      classData,
      Object.fromEntries(
        Object.entries(finalAbilities).map(([key, value]) => [
          key,
          value.score,
        ]),
      ) as Record<string, number>,
      level,
    );
  }

  // 5. Apply lineage effects (traits/spells/speed overrides)
  const lineageData = data.selectedLineage
    ? Object.entries(speciesData.lineages ?? {}).find(
        ([name]) => choiceId(name) === data.selectedLineage,
      )?.[1]
    : undefined;

  const mergedTraits = [
    ...(speciesData.species_traits || []),
    ...(lineageData?.traits || []),
  ];

  let effectiveSpeed = lineageData?.baseSpeed || speciesData.speed || 30;
  if (
    data.edition === '2014' &&
    (data.selectedLineage === 'wood-elf' ||
      data.selectedSpeciesVariant === 'wood-elf')
  ) {
    effectiveSpeed = 35;
  }

  // 6. Calculate Armor Class
  const allEquipment = loadEquipment();
  const dexMod = finalAbilities.DEX.modifier;

  let equippedArmorItem = undefined;
  let hasShield = false;

  for (const item of inventory) {
    const equip = allEquipment.find(
      (e) =>
        e.slug === item.equipmentSlug ||
        e.name.toLowerCase() === item.equipmentSlug.toLowerCase(),
    );
    if (!equip || !item.equipped) continue;

    if (equip.armor_category === 'Shield') {
      hasShield = true;
    } else if (equip.armor_class?.base) {
      if (item.equipped || !equippedArmorItem) {
        equippedArmorItem = equip;
      }
    }
  }

  let armorClass = BASE_ARMOR_CLASS + dexMod;
  const isWearingArmor = !!equippedArmorItem;
  if (!isWearingArmor && data.classSlug === 'barbarian')
    armorClass += finalAbilities.CON.modifier;
  if (!isWearingArmor && !hasShield && data.classSlug === 'monk')
    armorClass += finalAbilities.WIS.modifier;

  if (equippedArmorItem?.armor_class?.base) {
    const base = equippedArmorItem.armor_class.base;
    if (equippedArmorItem.armor_category === 'Light') {
      armorClass = base + dexMod;
    } else if (equippedArmorItem.armor_category === 'Medium') {
      armorClass = base + Math.min(2, dexMod);
    } else if (equippedArmorItem.armor_category === 'Heavy') {
      armorClass = base;
    } else {
      armorClass =
        base + (equippedArmorItem.armor_class.dex_bonus ? dexMod : 0);
    }
  }

  if (hasShield) {
    armorClass += 2;
  }

  // Fighting Style Defense: +1 AC while wearing armor
  const hasDefenseStyle =
    (data.fightingStyle || data.selectedFightingStyle || '').toLowerCase() ===
    'defense';
  if (hasDefenseStyle && isWearingArmor) {
    armorClass += 1;
  }

  // 7. Calculate Initiative (DEX modifier + Alert feat bonus if applicable)
  const hasAlert =
    backgroundData?.originFeat === 'alert' ||
    data.variantFeat === 'alert' ||
    data.cumulativeASI?.some(
      (choice) => choice.type === 'feat' && choice.featSlug === 'alert',
    ) ||
    data.originFeat === 'alert' ||
    data.speciesFeat === 'alert' ||
    data.humanOriginFeat === 'alert' ||
    data.humanVersatileFeat === 'alert' ||
    (data.selectedFeats && data.selectedFeats.includes('alert'));
  const initiative =
    finalAbilities.DEX.modifier +
    (hasAlert ? (edition === '2014' ? 5 : pb) : 0);

  // 8. Load Features and Traits
  const featuresAndTraits: Character['featuresAndTraits'] = {
    personality: data.personality || '',
    ideals: data.ideals || '',
    bonds: data.bonds || '',
    flaws: data.flaws || '',
    classFeatures: classData.class_features || [],
    speciesTraits: mergedTraits,
    backgroundFeatures: backgroundData
      ? [
          {
            name: backgroundData.feature || 'Background Feature',
            description:
              backgroundData.feature_description ||
              'A feature from your background.',
          },
        ]
      : [],
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
  if (edition === '2014' && data.variantFeat) allFeats.push(data.variantFeat);

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
  if (
    data.edition === '2024' &&
    data.speciesSlug === 'human-2024' &&
    data.humanVersatileFeat
  ) {
    allFeats.push(data.humanVersatileFeat);
  }

  if (data.cumulativeASI) {
    data.cumulativeASI.forEach((asiChoice) => {
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
      armor: [
        ...new Set([
          ...(classData.proficiencies?.armor || []),
          ...(edition === '2024' &&
          data.classSlug === 'cleric' &&
          data.divineOrder === 'protector'
            ? ['Heavy armor']
            : []),
          ...(edition === '2024' &&
          data.classSlug === 'druid' &&
          data.primalOrder === 'warden'
            ? ['Medium armor']
            : []),
        ]),
      ],
      weapons: [
        ...new Set([
          ...(classData.proficiencies?.weapons || []),
          ...(edition === '2024' &&
          ((data.classSlug === 'cleric' && data.divineOrder === 'protector') ||
            (data.classSlug === 'druid' && data.primalOrder === 'warden'))
            ? ['Martial Weapons']
            : []),
        ]),
      ],
      tools: Array.from(
        new Set([
          ...grantedFeatProficiencies(data).filter(
            (name) =>
              !ALL_SKILLS.some(
                (skill) => normalizeSkill(skill) === normalizeSkill(name),
              ),
          ),
          ...(classData.proficiencies?.tools || []),
          ...(backgroundData.tool_proficiencies || []),
        ]),
      ),
    },
    featChoices: data.featChoices
      ? structuredClone(data.featChoices)
      : undefined,
    selectedFeats: [
      ...new Set(allFeats.filter((feat) => feat !== 'versatile')),
    ],
    spellcasting: spellcastingData,
    castingSources: resolveCastingGrants(data).map((grant) => grant.source),
    srdFeatures,
    subclass: data.subclassSlug,
    experiencePoints: 0,
    feats: [...new Set(allFeats.filter((feat) => feat !== 'versatile'))], // Legacy support
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
      cp: currency.cp,
      sp: currency.sp,
      ep: currency.ep,
      gp: currency.gp,
      pp: currency.pp,
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
