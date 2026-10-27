/**
 * D&D 5e Spell Preparation Engine.
 * Validates preparation plans against class rules, edition mechanics, and preparation limits.
 */

import type { SpellcastingProfile } from '@nexus/game-contracts';

// SRD 5.2.1 class feature tables: pp31–32,36,41,53,58,65,71,77.
const FULL_PREPARATION = [
  4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22,
];
const WIZARD_PREPARATION = [
  4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25,
];
const HALF_PREPARATION = [
  2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15,
];

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
  if (!Number.isInteger(level) || level < 1 || level > 20) return 0;
  if (edition === '2024') {
    if (slug === 'wizard') return WIZARD_PREPARATION[level - 1];
    if (['cleric', 'druid', 'bard'].includes(slug))
      return FULL_PREPARATION[level - 1];
    if (['paladin', 'ranger'].includes(slug))
      return HALF_PREPARATION[level - 1];
    if (slug === 'sorcerer')
      return level === 1 ? 2 : level === 2 ? 4 : FULL_PREPARATION[level - 1];
    if (slug === 'warlock')
      return [
        2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15,
      ][level - 1];
  }

  switch (slug) {
    case 'artificer':
      return edition === '2014'
        ? Math.max(1, Math.floor(level / 2) + abilityModifier)
        : 0;
    case 'wizard':
    case 'cleric':
    case 'druid':
      return Math.max(1, level + abilityModifier);

    case 'paladin':
      return level < 2
        ? 0
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
      errors: [
        `Class ${profile.sourceSlug} uses a fixed repertoire of known spells and does not prepare daily.`,
      ],
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
  if (new Set(proposedSpellSlugs).size !== proposedSpellSlugs.length)
    errors.push('Duplicate prepared spells are not allowed.');
  if (accessibleSpells) {
    const accessibleSet = new Set(accessibleSpells.map((s) => s.toLowerCase()));
    for (const spell of proposedSpellSlugs) {
      if (!accessibleSet.has(spell.toLowerCase())) {
        invalidSpells.push(spell);
        errors.push(
          `Spell '${spell}' is not present in accessible spellbooks.`,
        );
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
