import { CreationDraft, DraftIssue } from '../types/draft';
import { getAllSpecies, loadClasses, BACKGROUNDS } from './dataService';

export interface CatalogValidationOptions {
  strictEntitlements?: boolean;
}

/**
 * Expected class skill pick counts at Level 1
 */
const CLASS_SKILL_COUNTS: Record<string, number> = {
  barbarian: 2,
  bard: 3,
  cleric: 2,
  druid: 2,
  fighter: 2,
  monk: 2,
  paladin: 2,
  ranger: 3,
  rogue: 4,
  sorcerer: 2,
  warlock: 2,
  wizard: 2,
};

/**
 * Resolves catalog items and checks entitlements, duplicates, and missing choices (CC-202)
 */
export function resolveCatalogEntitlements(
  draft: CreationDraft,
  _options: CatalogValidationOptions = {}
): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const edition = draft.edition;

  // 1. Validate Species
  if (!draft.speciesSlug) {
    issues.push({
      id: 'MISSING_SPECIES',
      step: 1,
      group: 'species',
      severity: 'error',
      message: 'Species is required.',
      repairTarget: 'species-selection',
    });
  } else {
    const speciesList = getAllSpecies(edition);
    const matchedSpecies = speciesList.find(
      s => s.slug === draft.speciesSlug || s.slug === `${draft.speciesSlug}-2024`
    );
    if (!matchedSpecies) {
      issues.push({
        id: 'INVALID_SPECIES_FOR_EDITION',
        step: 1,
        group: 'species',
        severity: 'error',
        message: `Species '${draft.speciesSlug}' is not available for edition ${edition}.`,
        repairTarget: 'species-selection',
      });
    }
  }

  // 2. Validate Class
  let matchedClass = undefined;
  if (!draft.classSlug) {
    issues.push({
      id: 'MISSING_CLASS',
      step: 2,
      group: 'class',
      severity: 'error',
      message: 'Class is required.',
      repairTarget: 'class-selection',
    });
  } else {
    const classList = loadClasses(edition);
    matchedClass = classList.find(c => c.slug === draft.classSlug);
    if (!matchedClass) {
      issues.push({
        id: 'INVALID_CLASS_FOR_EDITION',
        step: 2,
        group: 'class',
        severity: 'error',
        message: `Class '${draft.classSlug}' is not valid for edition ${edition}.`,
        repairTarget: 'class-selection',
      });
    }
  }

  // 3. Validate Background
  let matchedBg = undefined;
  if (!draft.backgroundSlug) {
    issues.push({
      id: 'MISSING_BACKGROUND',
      step: 3,
      group: 'background',
      severity: 'error',
      message: 'Background is required.',
      repairTarget: 'background-selection',
    });
  } else {
    const bgSlugToMatch = draft.backgroundSlug;
    matchedBg = BACKGROUNDS.find(
      bg =>
        bg.slug === bgSlugToMatch ||
        bg.slug === `${bgSlugToMatch}-2024` ||
        bg.name.toLowerCase() === bgSlugToMatch.toLowerCase()
    );
    if (!matchedBg) {
      issues.push({
        id: 'INVALID_BACKGROUND',
        step: 3,
        group: 'background',
        severity: 'error',
        message: `Background '${draft.backgroundSlug}' is unknown.`,
        repairTarget: 'background-selection',
      });
    }
  }

  // 4. Validate Ability Scores and Background ASI (2024)
  if (edition === '2024') {
    const method = draft.abilityBonuses.method;
    const bonuses = draft.abilityBonuses.bonuses;
    const bonusValues = Object.values(bonuses).filter((v): v is number => typeof v === 'number' && v > 0);
    const sum = bonusValues.reduce((a, b) => a + b, 0);

    if (method === '2/1') {
      const hasTwo = bonusValues.includes(2);
      const hasOne = bonusValues.filter(v => v === 1).length === 1;
      if (!hasTwo || !hasOne || sum !== 3) {
        issues.push({
          id: 'INVALID_2_1_BONUS_ALLOCATION',
          step: 4,
          group: 'abilities',
          severity: 'error',
          message: 'The +2 / +1 method requires exactly one +2 bonus and one +1 bonus to different abilities.',
          repairTarget: 'background-asi',
        });
      }
    } else if (method === '1/1/1') {
      const onesCount = bonusValues.filter(v => v === 1).length;
      if (onesCount !== 3 || sum !== 3) {
        issues.push({
          id: 'INVALID_1_1_1_BONUS_ALLOCATION',
          step: 4,
          group: 'abilities',
          severity: 'error',
          message: 'The +1 / +1 / +1 method requires exactly three +1 bonuses to different abilities.',
          repairTarget: 'background-asi',
        });
      }
    }
  }

  // 5. Skills & Duplicate Replacement Rule
  if (matchedClass) {
    const requiredSkillCount = CLASS_SKILL_COUNTS[matchedClass.slug] || 2;
    const selectedSkillCount = draft.skills.length;

    if (selectedSkillCount < requiredSkillCount) {
      issues.push({
        id: 'UNDER_ENTITLED_SKILLS',
        step: 5,
        group: 'class',
        severity: 'error',
        message: `Class ${matchedClass.name} requires selecting ${requiredSkillCount} skills, but ${selectedSkillCount} were chosen.`,
        repairTarget: 'skills-selection',
      });
    }

    // Check duplicate between background skills and class skills
    const bgSkills = (matchedBg?.skill_proficiencies || []).map(s => s.toLowerCase());
    const classSkills = draft.skills.map(s => s.toLowerCase());
    const duplicates = classSkills.filter(s => bgSkills.includes(s));

    if (duplicates.length > 0) {
      issues.push({
        id: 'DUPLICATE_SKILL_GRANT',
        step: 5,
        group: 'class',
        severity: 'warning',
        message: `Skills [${duplicates.join(', ')}] are already granted by background. The rules permit choosing any other skill to replace duplicates.`,
        repairTarget: 'skills-replacement',
      });
    }
  }

  // 6. Fighting Style requirement
  if (draft.classSlug === 'fighter' && !draft.fightingStyle) {
    issues.push({
      id: 'MISSING_FIGHTING_STYLE',
      step: 6,
      group: 'class',
      severity: 'error',
      message: 'Fighter requires choosing a Fighting Style at level 1.',
      repairTarget: 'fighting-style',
    });
  }

  // 7. Rogue Expertise requirement
  if (draft.classSlug === 'rogue') {
    if (!draft.expertise || draft.expertise.length < 2) {
      issues.push({
        id: 'INCOMPLETE_ROGUE_EXPERTISE',
        step: 6,
        group: 'class',
        severity: 'warning',
        message: 'Rogue receives Expertise in two skills or one skill and Thieves Tools at level 1.',
        repairTarget: 'expertise-selection',
      });
    }
  }

  return issues;
}
