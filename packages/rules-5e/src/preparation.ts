/**
 * D&D 5e Spell Preparation Engine.
 * Validates preparation plans against class rules, edition mechanics, and preparation limits.
 */

import type { SpellcastingProfile } from '@nexus/game-contracts';

/**
 * Calculates preparation capacity for prepared spellcasters.
 */
export function calculatePreparationLimit(
  classSlug: string,
  level: number,
  abilityModifier: number,
  edition: '2014' | '2024' = '2024',
): number {
  const slug = classSlug.toLowerCase();

  switch (slug) {
    case 'wizard':
    case 'cleric':
    case 'druid':
      return Math.max(1, level + abilityModifier);

    case 'paladin':
      return edition === '2024'
        ? Math.max(1, Math.ceil(level / 2) + abilityModifier)
        : Math.max(1, Math.floor(level / 2) + abilityModifier);

    case 'ranger':
      return edition === '2024'
        ? Math.max(1, Math.ceil(level / 2) + abilityModifier)
        : 0; // In 2014, Rangers were known spellcasters

    default:
      return Math.max(1, level + abilityModifier);
  }
}

export interface PreparationValidationResult {
  isValid: boolean;
  errors: string[];
  preparedCount: number;
  maxAllowed: number;
  invalidSpells: string[];
}

/**
 * Validates whether a proposed preparation plan can be legally applied to a spellcasting profile.
 */
export function evaluatePreparationPlan(
  profile: SpellcastingProfile,
  proposedSpellSlugs: string[],
  accessibleSpells?: string[], // e.g. for Wizard: spells recorded in accessible grimoires
): PreparationValidationResult {
  const errors: string[] = [];
  const invalidSpells: string[] = [];

  // If the profile is known-only (e.g. Sorcerer, Bard), daily preparation plans are not permitted
  if (profile.preparationMode === 'known') {
    return {
      isValid: false,
      errors: [`Class ${profile.sourceSlug} uses a fixed repertoire of known spells and does not prepare daily.`],
      preparedCount: proposedSpellSlugs.length,
      maxAllowed: profile.preparationLimit ?? profile.knownSpellSlugs.length,
      invalidSpells: proposedSpellSlugs,
    };
  }

  const maxAllowed = profile.preparationLimit ?? 1;

  // Check capacity
  if (proposedSpellSlugs.length > maxAllowed) {
    errors.push(
      `Plan exceeds preparation capacity: ${proposedSpellSlugs.length} chosen, max allowed is ${maxAllowed}.`,
    );
  }

  // If accessible spells are provided (e.g. Wizard book learning), verify every spell is present
  if (accessibleSpells && accessibleSpells.length > 0) {
    const accessibleSet = new Set(accessibleSpells.map((s) => s.toLowerCase()));
    for (const spell of proposedSpellSlugs) {
      if (!accessibleSet.has(spell.toLowerCase())) {
        invalidSpells.push(spell);
        errors.push(`Spell '${spell}' is not present in accessible spellbooks.`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    preparedCount: proposedSpellSlugs.length,
    maxAllowed,
    invalidSpells,
  };
}
