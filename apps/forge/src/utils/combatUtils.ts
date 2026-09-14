/**
 * Combat Utilities - Feat-based combat mechanics
 *
 * Handles advanced combat rules from feats like Great Weapon Master,
 * Polearm Master, Second Chance, etc.
 */

import { Character } from '../types/dnd';

export interface CombatAction {
  type: 'attack' | 'damage' | 'reaction' | 'bonus-action';
  source: 'weapon' | 'spell' | 'feat' | 'class-feature';
  // Dynamic combat details - structure varies by combat event type
  // Examples: weapon attacks (damage type, range), spells (save DC, area), etc.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Record<string, any>;
}

export interface CombatResult {
  success: boolean;
  critical?: boolean;
  damage?: number;
  effects?: string[];
}

/**
 * Check if Great Weapon Master bonus attack is available
 */
export function isGWMBonusAttackAvailable(character: Character): boolean {
  return character.featEffects?.gwmBonusAttackAvailable || false;
}

/**
 * Trigger Great Weapon Master bonus attack opportunity
 */
export function triggerGWMBonusAttack(character: Character, wasCritical: boolean, reducedToZeroHP: boolean): boolean {
  if (!character.featEffects?.greatWeaponMaster) return false;

  // GWM bonus attack triggers on critical hit or reducing creature to 0 HP
  if (wasCritical || reducedToZeroHP) {
    if (!character.featEffects.gwmBonusAttackAvailable) {
      character.featEffects!.gwmBonusAttackAvailable = true;
      return true;
    }
  }
  return false;
}

/**
 * Use Great Weapon Master bonus attack
 */
export function useGWMBonusAttack(character: Character): boolean {
  if (character.featEffects?.gwmBonusAttackAvailable) {
    character.featEffects.gwmBonusAttackAvailable = false;
    return true;
  }
  return false;
}

/**
 * Check if Polearm Master opportunity attack is available
 */
export function canPolearmMasterAttack(character: Character, targetMoved: boolean, weaponType: string): boolean {
  if (!character.featEffects?.polearmMaster) return false;

  // Polearm Master: When a creature enters the reach you have with a polearm, you can make one attack against it with the polearm as a reaction
  return targetMoved && weaponType === 'polearm';
}

/**
 * Check if Second Chance reaction is available
 */
export function canUseSecondChance(character: Character): boolean {
  if (!character.featEffects?.secondChance) return false;

  // Check if Second Chance resource is available
  const secondChanceResource = character.resources?.find(r => r.id === 'second-chance');
  return secondChanceResource ? (secondChanceResource.currentUses || 0) > 0 : false;
}

/**
 * Use Second Chance reaction
 */
export function useSecondChance(character: Character): boolean {
  const secondChanceResource = character.resources?.find(r => r.id === 'second-chance');
  if (secondChanceResource && (secondChanceResource.currentUses || 0) > 0) {
    secondChanceResource.currentUses = (secondChanceResource.currentUses || 0) - 1;
    return true;
  }
  return false;
}

/**
 * Check if Bountiful Luck can be used
 */
export function canUseBountifulLuck(character: Character): boolean {
  return character.featEffects?.bountifulLuck || false;
}

/**
 * Apply feat-based damage modifiers
 */
export function applyFeatDamageModifiers(character: Character, weaponType: string, damageType: string, isCritical: boolean): number {
  let damageModifier = 0;

  // Great Weapon Master: -5 attack, +10 damage with heavy weapons
  if (character.featEffects?.greatWeaponMaster && weaponType === 'heavy') {
    damageModifier += 10;
  }

  // Crusher: +1d8 force damage on critical hits
  if (character.featEffects?.crusher && isCritical) {
    damageModifier += Math.floor(Math.random() * 8) + 1; // 1d8
  }

  // Piercer: +1d8 piercing damage on critical hits
  if (character.featEffects?.piercer && damageType === 'piercing' && isCritical) {
    damageModifier += Math.floor(Math.random() * 8) + 1; // 1d8
  }

  // Slasher: +1d8 slashing damage on critical hits
  if (character.featEffects?.slasher && damageType === 'slashing' && isCritical) {
    damageModifier += Math.floor(Math.random() * 8) + 1; // 1d8
  }

  return damageModifier;
}

/**
 * Apply feat-based attack modifiers
 */
export function applyFeatAttackModifiers(character: Character, weaponType: string): { attackBonus: number; damagePenalty: number } {
  let attackBonus = 0;
  const damagePenalty = 0;

  // Great Weapon Master: -5 attack, +10 damage with heavy weapons
  if (character.featEffects?.greatWeaponMaster && weaponType === 'heavy') {
    attackBonus -= 5;
    // Damage bonus is handled in applyFeatDamageModifiers
  }

  return { attackBonus, damagePenalty };
}

/**
 * Check if Mobile feat benefits apply
 */
export function applyMobileBenefits(character: Character, action: string, terrain: string): { speedBonus: number; ignoreOpportunity: boolean } {
  if (!character.featEffects?.mobile) {
    return { speedBonus: 0, ignoreOpportunity: false };
  }

  let speedBonus = 0;
  let ignoreOpportunity = false;

  // Mobile: +10 speed, ignore difficult terrain on Dash, don't provoke opportunity attacks on melee attacks
  if (action === 'dash' && terrain === 'difficult') {
    speedBonus = 10; // Difficult terrain doesn't cost extra movement on Dash
  }

  if (action === 'melee-attack') {
    ignoreOpportunity = true; // Don't provoke opportunity attacks from the target
  }

  return { speedBonus, ignoreOpportunity };
}

/**
 * Check if War Caster benefits apply
 */
export function applyWarCasterBenefits(character: Character, situation: string): { advantage: boolean; canCastAsReaction: boolean; somaticWithoutHands: boolean } {
  if (!character.featEffects?.warCaster) {
    return { advantage: false, canCastAsReaction: false, somaticWithoutHands: false };
  }

  let advantage = false;
  let canCastAsReaction = false;
  let somaticWithoutHands = false;

  // War Caster benefits
  if (situation === 'concentration-save') {
    advantage = true; // Advantage on concentration saves
  }

  if (situation === 'opportunity-attack') {
    canCastAsReaction = true; // Can cast spells as opportunity attacks
  }

  if (situation === 'somatic-components') {
    somaticWithoutHands = true; // Somatic components don't require free hand
  }

  return { advantage, canCastAsReaction, somaticWithoutHands };
}

/**
 * Get feat-based AC bonuses
 */
export function getFeatACBonuses(character: Character, weaponsWielded: number): number {
  let acBonus = 0;

  // Dual Wielder: +1 AC when wielding melee weapon in each hand
  if (character.featEffects?.dualWielder && weaponsWielded >= 2) {
    acBonus += 1;
  }

  return acBonus;
}

/**
 * Reset turn-based feat effects
 */
export function resetTurnBasedFeatEffects(character: Character): void {
  // Reset Great Weapon Master bonus attack
  if (character.featEffects?.gwmBonusAttackAvailable) {
    character.featEffects.gwmBonusAttackAvailable = false;
  }

  // Other turn-based resets can be added here
}