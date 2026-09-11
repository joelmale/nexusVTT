/**
 * Utility to extract BaseFacts from existing Character objects
 * Used for migration and testing
 */

import type { Character } from '../../types/dnd';
import type { BaseFacts } from '../types/baseFacts';

/**
 * Extract base facts from an existing character
 * This is used to convert old Character format to new BaseFacts format
 *
 * @param character - Existing character object
 * @returns BaseFacts for rules engine
 */
export function extractBaseFacts(character: Character): BaseFacts {
  // Extract base ability scores (before any modifiers)
  const abilities = {
    STR: character.abilities.STR.score,
    DEX: character.abilities.DEX.score,
    CON: character.abilities.CON.score,
    INT: character.abilities.INT.score,
    WIS: character.abilities.WIS.score,
    CHA: character.abilities.CHA.score,
  };

  // Build class level map (for multiclass support)
  const classLevel: Record<string, number> = {
    [character.class]: character.level,
  };

  // Extract choices made during character creation
  const choices: Record<string, string | string[] | number> = {};

  // Divine Order (2024 Cleric)
  if (character.divineOrder) {
    choices['divine-order'] = character.divineOrder;
  }

  // Primal Order (2024 Druid)
  if (character.primalOrder) {
    choices['primal-order'] = character.primalOrder;
  }

  // Pact Boon (Warlock)
  if (character.pactBoon) {
    choices['pact-boon'] = character.pactBoon;
  }

  // Expertise skills
  if (character.expertiseSkills && character.expertiseSkills.length > 0) {
    choices['expertise-skills'] = character.expertiseSkills;
  }

  // Weapon mastery
  if (character.weaponMastery && character.weaponMastery.length > 0) {
    choices['weapon-mastery'] = character.weaponMastery;
  }

  // Fighting style
  if (character.fightingStyle) {
    choices['fighting-style'] = character.fightingStyle;
  }

  // Eldritch invocations
  if (character.eldritchInvocations && character.eldritchInvocations.length > 0) {
    choices['eldritch-invocations'] = character.eldritchInvocations;
  }

  // Extract equipment state
  const equippedArmor = character.equippedArmor;
  const equippedWeapons = character.equippedWeapons ?? [];
  const equippedItems: string[] = [
    ...(equippedArmor ? [equippedArmor] : []),
    ...equippedWeapons,
  ];

  // Extract conditions
  const conditions = character.conditions ?? [];

  // Build initial tags from species and class
  const tags: string[] = [
    `species:${character.species}`,
    `class:${character.class}`,
    `edition:${character.edition}`,
  ];

  if (character.subclass) {
    tags.push(`subclass:${character.subclass}`);
  }

  if (character.background) {
    tags.push(`background:${character.background}`);
  }

  // Add feat tags
  const feats = character.selectedFeats ?? character.feats ?? [];

  return {
    level: character.level,
    classSlug: character.class,
    classLevel,
    subclassSlug: character.subclass ?? undefined,
    speciesSlug: character.species,
    lineageSlug: character.selectedSpeciesVariant,
    backgroundSlug: character.background,
    edition: character.edition,
    abilities,
    choices,
    equippedArmor,
    equippedWeapons,
    equippedItems,
    conditions,
    tags,
    feats,
  };
}

/**
 * Extract multiple base facts from multiple characters
 */
export function extractMultipleBaseFacts(characters: Character[]): BaseFacts[] {
  return characters.map(extractBaseFacts);
}
