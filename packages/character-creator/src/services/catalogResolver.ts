import { CreationDraft, DraftIssue } from '../types/draft';
import { isPermittedContentSource } from '../data/contentProvenance';
import { getSubclassLevel } from '../data/supportManifest';
import { classExpertiseErrors } from './expertiseChoices';
import { draftToCreationData } from '../adapters/draftAdapter';
import {
  getAllSpecies,
  loadClasses,
  BACKGROUNDS,
  ALL_SKILLS,
  loadSpells,
  getSubclassesByClass,
} from './dataService';

export interface CatalogValidationOptions {
  strictEntitlements?: boolean;
  allowedSources?: string[];
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
  _options: CatalogValidationOptions = {},
): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const edition = draft.edition;
  const normalize = (value: string) =>
    value.replace(/[^a-z]/gi, '').toLowerCase();
  const error = (
    id: string,
    group: DraftIssue['group'],
    message: string,
    step = 4,
  ) =>
    issues.push({
      id,
      group,
      message,
      step,
      severity: 'error',
      repairTarget: `${group}-selection`,
    });
  if (
    _options.strictEntitlements &&
    !(_options.allowedSources ?? draft.allowedSources)
  )
    error(
      'MISSING_SOURCE_POLICY',
      'finalization',
      'This game requires an explicit allowed content source list.',
    );
  const scores = Object.values(draft.rawAbilityScores);
  if (
    scores.length !== 6 ||
    scores.some((value) => !Number.isInteger(value) || value < 1 || value > 20)
  )
    error(
      'INVALID_BASE_SCORES',
      'abilities',
      'Each ability must be an integer from 1 to 20.',
    );
  if (
    draft.abilityMethod === 'standard' &&
    [...scores].sort((a, b) => a - b).join() !== '8,10,12,13,14,15'
  )
    error(
      'INVALID_STANDARD_ARRAY',
      'abilities',
      'Assign each standard array score exactly once.',
    );
  if (draft.abilityMethod === 'point-buy') {
    const costs: Record<number, number> = {
      8: 0,
      9: 1,
      10: 2,
      11: 3,
      12: 4,
      13: 5,
      14: 7,
      15: 9,
    };
    if (
      scores.some((value) => costs[value] === undefined) ||
      scores.reduce((sum, value) => sum + (costs[value] ?? 100), 0) > 27
    )
      error(
        'INVALID_POINT_BUY',
        'abilities',
        'Use scores from 8 to 15 within the 27 point budget.',
      );
  }
  if (
    Object.entries(draft.abilityBonuses.bonuses).some(
      ([key, value]) =>
        !Number.isInteger(value) ||
        (value || 0) < 0 ||
        (draft.rawAbilityScores[key as keyof typeof draft.rawAbilityScores] ||
          0) +
          (value || 0) >
          20,
    )
  )
    error(
      'INVALID_ABILITY_BONUS',
      'abilities',
      'Ability increases must be whole numbers and cannot raise a score above 20.',
    );

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
      (s) =>
        s.slug === draft.speciesSlug || s.slug === `${draft.speciesSlug}-2024`,
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
    matchedClass = classList.find((c) => c.slug === draft.classSlug);
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

  if (matchedClass?.source.startsWith('Unverified'))
    error(
      'UNVERIFIED_CLASS_SOURCE',
      'class',
      'This supplemental class needs a verified source and edition revision before creation can complete.',
    );
  if (
    matchedClass &&
    draft.level >= getSubclassLevel(matchedClass.slug, edition)
  ) {
    const subclass = getSubclassesByClass(matchedClass.slug, edition).find(
      (entry) => entry.slug === draft.subclassSlug,
    );
    if (!subclass)
      error(
        'MISSING_OR_INVALID_SUBCLASS',
        'class',
        'Choose an available subclass for this class and level.',
      );
    else if (
      subclass.supportStatus === 'legacy-compatibility-unverified' ||
      subclass.source?.startsWith('Unverified')
    )
      error(
        'UNVERIFIED_SUBCLASS_SOURCE',
        'class',
        'This subclass requires source or edition-compatibility review. Choose a verified subclass or preserve the existing imported record without recreating it.',
      );
    else if (
      (_options.allowedSources ?? draft.allowedSources) &&
      subclass.source &&
      !isPermittedContentSource(
        'subclass',
        subclass.slug,
        edition,
        subclass.source,
        (_options.allowedSources ?? draft.allowedSources)!,
      )
    )
      error(
        'DISALLOWED_SUBCLASS_SOURCE',
        'class',
        'Your game does not permit this subclass source.',
      );
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
      (bg) =>
        bg.edition === edition &&
        (bg.slug === bgSlugToMatch ||
          bg.slug === `${bgSlugToMatch}-${edition}` ||
          bg.name.toLowerCase() === bgSlugToMatch.toLowerCase()),
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
    const bonusValues = Object.values(bonuses).filter(
      (v): v is number => typeof v === 'number' && v > 0,
    );
    const sum = bonusValues.reduce((a, b) => a + b, 0);
    const allowed = matchedBg?.abilityScores?.from || [];
    if (
      Object.entries(bonuses).some(
        ([ability, amount]) =>
          amount && !allowed.includes(ability as keyof typeof bonuses),
      )
    )
      issues.push({
        id: 'INVALID_BACKGROUND_BONUS_TARGET',
        step: 4,
        group: 'abilities',
        severity: 'error',
        message: 'Choose ability increases from your background abilities.',
        repairTarget: 'background-asi',
      });

    if (!method)
      error(
        'MISSING_BACKGROUND_BONUSES',
        'abilities',
        'Choose background ability increases.',
      );
    if (method === '2/1') {
      const hasTwo = bonusValues.includes(2);
      const hasOne = bonusValues.filter((v) => v === 1).length === 1;
      if (!hasTwo || !hasOne || sum !== 3) {
        issues.push({
          id: 'INVALID_2_1_BONUS_ALLOCATION',
          step: 4,
          group: 'abilities',
          severity: 'error',
          message:
            'The +2 / +1 method requires exactly one +2 bonus and one +1 bonus to different abilities.',
          repairTarget: 'background-asi',
        });
      }
    } else if (method === '1/1/1') {
      const onesCount = bonusValues.filter((v) => v === 1).length;
      if (onesCount !== 3 || sum !== 3) {
        issues.push({
          id: 'INVALID_1_1_1_BONUS_ALLOCATION',
          step: 4,
          group: 'abilities',
          severity: 'error',
          message:
            'The +1 / +1 / +1 method requires exactly three +1 bonuses to different abilities.',
          repairTarget: 'background-asi',
        });
      }
    }
  }

  // 5. Skills & Duplicate Replacement Rule
  if (matchedClass) {
    const requiredSkillCount = CLASS_SKILL_COUNTS[matchedClass.slug] || 2;
    const selectedSkillCount = new Set(draft.skills.map(normalize)).size;
    if (
      draft.skills.some(
        (skill) =>
          !ALL_SKILLS.some(
            (allowed) => normalize(allowed) === normalize(skill),
          ),
      )
    )
      error('UNKNOWN_SKILL', 'class', 'Choose known skills.');
    const pool = matchedClass.skill_proficiencies.map(normalize);
    if (draft.skills.some((skill) => !pool.includes(normalize(skill))))
      error(
        'INVALID_CLASS_SKILL',
        'class',
        'Choose skills from your class list.',
      );
    if (
      selectedSkillCount > requiredSkillCount ||
      selectedSkillCount !== draft.skills.length
    )
      error(
        'INVALID_CLASS_SKILL_COUNT',
        'class',
        `Choose ${requiredSkillCount} different class skills.`,
      );

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
    const bgSkills = (matchedBg?.skill_proficiencies || []).map((s) =>
      s.toLowerCase(),
    );
    const classSkills = draft.skills.map((s) => s.toLowerCase());
    const duplicates = classSkills.filter((s) => bgSkills.includes(s));

    if (duplicates.length > 0) {
      issues.push({
        id: 'DUPLICATE_SKILL_GRANT',
        step: 5,
        group: 'class',
        severity: 'error',
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

  for (const message of classExpertiseErrors(draftToCreationData(draft)))
    error('INVALID_EXPERTISE', 'class', message);
  if (
    draft.loadout.items.some(
      (item) => !Number.isInteger(item.quantity) || item.quantity < 1,
    )
  )
    error(
      'INVALID_EQUIPMENT_QUANTITY',
      'equipment',
      'Equipment quantities must be positive integers.',
    );
  if (
    Object.values(draft.loadout.currency).some(
      (value) => !Number.isInteger(value) || value < 0,
    )
  )
    error(
      'INVALID_CURRENCY',
      'equipment',
      'Coin quantities must be nonnegative integers.',
    );
  const equipped = draft.loadout.items.filter((item) => item.equipped);
  if (
    equipped.filter((item) => item.slot === 'armor').length > 1 ||
    equipped.filter((item) => item.slot === 'shield').length > 1 ||
    (equipped.some((item) => item.slot === 'two_handed') &&
      equipped.some(
        (item) => item.slot === 'shield' || item.slot === 'main_hand',
      ))
  )
    error(
      'CONFLICTING_EQUIPPED_ITEMS',
      'equipment',
      'Choose a compatible set of equipped armor and weapons.',
    );
  const allowedSources = _options.allowedSources || draft.allowedSources;
  if (
    allowedSources &&
    matchedClass &&
    !isPermittedContentSource(
      'class',
      matchedClass.slug,
      edition,
      matchedClass.source,
      allowedSources,
    )
  )
    error(
      'DISALLOWED_CLASS_SOURCE',
      'class',
      'Your game does not permit this class source.',
    );
  if (allowedSources) {
    if (
      matchedBg?.source &&
      !isPermittedContentSource(
        'background',
        matchedBg.slug,
        edition,
        matchedBg.source,
        allowedSources,
      )
    )
      error(
        'DISALLOWED_BACKGROUND_SOURCE',
        'background',
        'Your game does not permit this background source.',
      );
    const species = getAllSpecies(edition).find(
      (entry) =>
        entry.slug === draft.speciesSlug ||
        entry.slug === `${draft.speciesSlug}-2024`,
    );
    if (
      species &&
      !isPermittedContentSource(
        'species',
        species.slug,
        edition,
        species.source,
        allowedSources,
        draft.lineageSlug ??
          draft.creationData?.variantSlug ??
          draft.creationData?.selectedSpeciesVariant,
      )
    )
      error(
        'DISALLOWED_SPECIES_SOURCE',
        'species',
        'Your game does not permit this species source.',
      );
    const catalog = loadSpells(edition);
    const selected = [
      ...draft.spells.cantrips,
      ...draft.spells.knownOrBook,
      ...draft.spells.prepared,
    ];
    if (
      selected.some((slug) => {
        const spell = catalog.find((entry) => entry.slug === slug);
        return spell && !allowedSources.includes(`SRD ${spell.source}`);
      })
    )
      error(
        'DISALLOWED_SPELL_SOURCE',
        'spells',
        'Your game does not permit one or more selected spell sources.',
      );
  }
  return issues;
}
