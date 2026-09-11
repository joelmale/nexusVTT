/**
 * Schema adapter for transforming 5e Character Forge exports to NexusVTT format
 */

import type { Character, SkillMap } from '@/types/character';
import { createEmptyCharacter } from '@/types/character';
import { normalizeSkillKey } from '@/utils/characterNormalization';
import type { ForgeCharacter, ImportMetadata } from './forgeTypes';

export class ForgeCharacterAdapter {
  /**
   * Validate that the data is a Forge character export
   */
  validate(data: unknown): data is ForgeCharacter {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const char = data as Record<string, unknown>;

    // Check for Forge-specific fields
    const hasForgeFields = (
      'species' in char &&
      'edition' in char &&
      typeof char.abilities === 'object' &&
      char.abilities !== null &&
      'STR' in char.abilities
    );

    return hasForgeFields;
  }

  /**
   * Transform Forge character to NexusVTT format
   */
  transform(forgeChar: ForgeCharacter, playerId: string = ''): Character {
    const base = createEmptyCharacter(playerId);
    const now = new Date().toISOString();

    const skills: SkillMap = { ...base.skills };
    Object.entries(forgeChar.skills || {}).forEach(([name, skill]) => {
      const normalizedName = normalizeSkillKey(name);
      skills[normalizedName] = {
        proficient: !!skill.proficient,
        expertise: skill.expertise,
        value: skill.value,
      };
    });

    const featuresAndTraits = forgeChar.featuresAndTraits
      ? {
          personality: forgeChar.featuresAndTraits.personality,
          ideals: forgeChar.featuresAndTraits.ideals,
          bonds: forgeChar.featuresAndTraits.bonds,
          flaws: forgeChar.featuresAndTraits.flaws,
          classFeatures: forgeChar.featuresAndTraits.classFeatures,
          racialTraits: forgeChar.featuresAndTraits.speciesTraits,
          backgroundFeatures: forgeChar.featuresAndTraits.backgroundFeatures,
        }
      : undefined;

    return {
      ...base,
      id: forgeChar.id || base.id,
      playerId: playerId || base.playerId,
      name: forgeChar.name || base.name,
      race: forgeChar.race || forgeChar.species || base.race,
      species: forgeChar.species || forgeChar.race || base.species,
      class: forgeChar.class || base.class,
      subclass: forgeChar.subclass ?? base.subclass,
      background: forgeChar.background || base.background,
      alignment: forgeChar.alignment || base.alignment,
      level: forgeChar.level || base.level,
      edition: forgeChar.edition || base.edition,
      inspiration: forgeChar.inspiration ?? base.inspiration,
      proficiencyBonus: forgeChar.proficiencyBonus || base.proficiencyBonus,
      armorClass: forgeChar.armorClass || base.armorClass,
      hitPoints: forgeChar.hitPoints ?? base.hitPoints,
      maxHitPoints: forgeChar.maxHitPoints ?? base.maxHitPoints,
      temporaryHitPoints:
        forgeChar.temporaryHitPoints ?? base.temporaryHitPoints,
      hitDice: forgeChar.hitDice || base.hitDice,
      speed: forgeChar.speed || base.speed,
      initiative: forgeChar.initiative ?? base.initiative,
      abilities: forgeChar.abilities || base.abilities,
      skills,
      languages: forgeChar.languages || base.languages,
      featuresAndTraits,
      selectedFeats: forgeChar.selectedFeats,
      feats: forgeChar.feats,
      srdFeatures: forgeChar.srdFeatures,
      spellcasting: forgeChar.spellcasting,
      inventory:
        forgeChar.inventory?.map((item) => ({
          equipmentSlug: (item.id || item.name)
            .toLowerCase()
            .replace(/\s+/g, '-'),
          equipped: item.equipped,
          quantity: item.quantity || 1,
        })) || base.inventory,
      currency: forgeChar.currency || base.currency,
      equippedWeapons: forgeChar.equippedWeapons,
      experiencePoints: forgeChar.experiencePoints || base.experiencePoints,
      resources: forgeChar.resources,
      deathSaves: forgeChar.deathSaves,
      conditions: forgeChar.conditions,
      createdAt: forgeChar.createdAt || base.createdAt || now,
      updatedAt: forgeChar.updatedAt || base.updatedAt || now,
    };
  }

  /**
   * Generate import metadata
   */
  generateMetadata(forgeChar: ForgeCharacter, _originalFileName?: string): ImportMetadata {
    return {
      sourceType: 'forge',
      sourceVersion: forgeChar.edition,
      importedAt: Date.now(),
      originalId: forgeChar.id,
    };
  }
}
