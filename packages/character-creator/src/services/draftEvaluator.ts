import { calculatePreparationLimit } from '@nexus/rules-5e';
import { Character } from '../types/dnd';
import { CharacterCreationResult } from '../api/types';
import {
  CreationDraft,
  DraftEvaluationResult,
  DraftIssue,
} from '../types/draft';
import { draftToCreationData } from '../adapters/draftAdapter';
import { resolveCatalogEntitlements } from './catalogResolver';
import { resolveLoadout } from './loadoutResolver';
import { castingGrantErrors } from './castingSources';
import { originChoiceErrors } from './originChoices';
import { classGrantErrors } from './classGrantChoices';
import { featEntitlementErrors } from './featEntitlements';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import { loadClasses, loadSpells, SPELLS_KNOWN_BY_CLASS } from './dataService';
import cantripsData from '../data/cantrips.json';

const EVALUATOR_VERSION = '1.0.0';

/**
 * Validates edition-specific spellcasting limits (CC-205)
 */
function validateSpellcasting(
  draft: CreationDraft,
  calculated: Character,
): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const classList = loadClasses(draft.edition);
  const classData = classList.find((c) => c.slug === draft.classSlug);
  const issue = (id: string, message: string) =>
    issues.push({
      id,
      step: 4,
      group: 'spells',
      severity: 'error',
      message,
      repairTarget: 'spell-selection',
    });
  const selected = [
    ...draft.spells.cantrips,
    ...draft.spells.knownOrBook,
    ...draft.spells.prepared,
  ];

  if (!classData?.spellcasting) {
    if (selected.length)
      issue(
        'NONCASTER_CLASS_SPELLS',
        'This class has no spellcasting at this level. Keep source-granted spells in their own casting source.',
      );
    return issues;
  }

  // Check Cantrips count
  let requiredCantrips =
    (cantripsData as Record<string, Record<string, number>>)[
      draft.classSlug || ''
    ]?.[draft.level] ||
    classData.spellcasting.cantripsKnown ||
    0;

  if (
    draft.edition === '2024' &&
    ((draft.classSlug === 'cleric' &&
      draft.creationData?.divineOrder === 'thaumaturge') ||
      (draft.classSlug === 'druid' &&
        draft.creationData?.primalOrder === 'magician'))
  )
    requiredCantrips += 1;

  const selectedCantripsCount = draft.spells.cantrips.length;
  const catalog = loadSpells(draft.edition);
  const slots = calculated.spellcasting?.spellSlots ?? [];
  const maximumLevel = Math.max(
    0,
    ...slots.flatMap((count, index) => (index > 0 && count > 0 ? [index] : [])),
  );
  for (const list of [
    draft.spells.cantrips,
    draft.spells.knownOrBook,
    draft.spells.prepared,
  ]) {
    if (new Set(list).size !== list.length)
      issue('DUPLICATE_SPELL', 'Choose each spell only once in a spell list.');
  }
  for (const slug of new Set(selected)) {
    const spell = catalog.find((entry) => entry.slug === slug);
    if (!spell || !spell.classes.includes(draft.classSlug ?? ''))
      issue(
        'INVALID_CLASS_SPELL',
        `Spell '${slug}' is unavailable to this class in ${draft.edition}.`,
      );
    else if (
      draft.spells.cantrips.includes(slug)
        ? spell.level !== 0
        : spell.level < 1 || spell.level > maximumLevel
    )
      issue(
        'INVALID_SPELL_LEVEL',
        `Spell '${slug}' is not available at this character level.`,
      );
  }
  const extraCantrip =
    draft.edition === '2014' &&
    draft.creationData?.selectedLineage === 'high-elf'
      ? 1
      : 0;
  if (selectedCantripsCount > requiredCantrips + extraCantrip)
    issue(
      'EXCESS_CANTRIPS',
      'Too many class cantrips are selected. Keep source grants separate.',
    );
  if (selectedCantripsCount < requiredCantrips) {
    issues.push({
      id: 'INSUFFICIENT_CANTRIPS_SELECTED',
      step: 4,
      group: 'spells',
      severity: 'error',
      message: `${classData.name} requires selecting ${requiredCantrips} cantrips, but ${selectedCantripsCount} were selected.`,
      repairTarget: 'spell-selection',
    });
  }

  // Check Wizard Spellbook and Preparation (2014 vs 2024)
  if (draft.classSlug === 'wizard') {
    const spellbookCount = draft.spells.knownOrBook.length;
    if (draft.level === 1 && spellbookCount < 6) {
      issues.push({
        id: 'INSUFFICIENT_WIZARD_SPELLBOOK',
        step: 4,
        group: 'spells',
        severity: 'error',
        message:
          'A 1st-level Wizard starts with 6 1st-level spells in their spellbook.',
        repairTarget: 'spell-selection',
      });
    }

    const intMod = calculated.abilities.INT.modifier;
    const maxPrepared = calculatePreparationLimit(
      'wizard',
      draft.level,
      intMod,
      draft.edition,
    );

    const preparedCount = draft.spells.prepared.length;
    if (
      draft.spells.prepared.some(
        (slug) => !draft.spells.knownOrBook.includes(slug),
      )
    )
      issue(
        'PREPARED_OUTSIDE_SPELLBOOK',
        'Prepare only spells recorded in your spellbook.',
      );
    if (preparedCount > maxPrepared) {
      issues.push({
        id: 'EXCEEDED_PREPARED_SPELLS_LIMIT',
        step: 4,
        group: 'spells',
        severity: 'error',
        message: `You have prepared ${preparedCount} spells, but your maximum prepared spells is ${maxPrepared}.`,
        repairTarget: 'spell-preparation',
      });
    }
  }

  const casting = calculated.spellcasting;
  if (casting && draft.classSlug !== 'wizard') {
    if (casting.spellcastingType === 'known') {
      const required =
        draft.edition === '2024'
          ? calculatePreparationLimit(
              draft.classSlug ?? '',
              draft.level,
              0,
              '2024',
            )
          : ((SPELLS_KNOWN_BY_CLASS as Record<string, Record<string, number>>)[
              draft.classSlug ?? ''
            ]?.[draft.level] ?? classData.spellcasting.spellsKnownOrPrepared);
      if (draft.spells.knownOrBook.length !== required)
        issue(
          'INVALID_KNOWN_SPELL_COUNT',
          `Choose ${required} known spells for this class and level.`,
        );
    } else {
      const abilityModifier = calculated.abilities[casting.ability].modifier;
      const limit = calculatePreparationLimit(
        draft.classSlug ?? '',
        draft.level,
        abilityModifier,
        draft.edition,
      );
      if (draft.spells.prepared.length > limit)
        issue(
          'EXCESS_PREPARED_SPELLS',
          `Prepare at most ${limit} class spells.`,
        );
    }
  }

  return issues;
}

/**
 * Evaluates a canonical CreationDraft against rules and catalog entitlements (CC-204, CC-205)
 */
export function evaluateDraft(draft: CreationDraft): DraftEvaluationResult {
  // 1. Resolve loadout
  const resolvedLoadout = resolveLoadout(draft);
  const updatedDraft: CreationDraft = {
    ...draft,
    loadout: resolvedLoadout,
  };

  // 2. Catalog & Entitlement checks (CC-202)
  const catalogIssues = resolveCatalogEntitlements(updatedDraft);
  if (
    catalogIssues.some((issue) =>
      [
        'MISSING_SPECIES',
        'INVALID_SPECIES_FOR_EDITION',
        'MISSING_CLASS',
        'INVALID_CLASS_FOR_EDITION',
        'MISSING_BACKGROUND',
        'INVALID_BACKGROUND',
      ].includes(issue.id),
    )
  ) {
    return {
      draft: updatedDraft,
      issues: catalogIssues,
      isValid: false,
      evaluatedAt: new Date().toISOString(),
      evaluatorVersion: EVALUATOR_VERSION,
      draftRevision: draft.revision ?? 0,
      draftFingerprint: JSON.stringify(updatedDraft),
    };
  }

  // 3. Compute Character Stats
  const creationData = draftToCreationData(updatedDraft);
  const calculatedCharacter = calculateCharacterStats(creationData);

  // Sync loadout items and currency into calculated character
  calculatedCharacter.currency = {
    cp: resolvedLoadout.currency.cp,
    sp: resolvedLoadout.currency.sp,
    ep: resolvedLoadout.currency.ep,
    gp: resolvedLoadout.currency.gp,
    pp: resolvedLoadout.currency.pp,
  };

  // 4. Validate Spellcasting (CC-205)
  const spellIssues = validateSpellcasting(updatedDraft, calculatedCharacter);

  const sourceIssues: DraftIssue[] = castingGrantErrors(creationData).map(
    (message) => ({
      id: 'INVALID_CASTING_SOURCE',
      group: 'spells',
      step: 4,
      severity: 'error',
      message,
      repairTarget: 'casting-source-selection',
    }),
  );
  const classIssues: DraftIssue[] = classGrantErrors(creationData).map(
    (message) => ({
      id: 'INVALID_CLASS_GRANT',
      group: 'class',
      step: 3,
      severity: 'error',
      message,
      repairTarget: 'class-grant-selection',
    }),
  );
  const originIssues: DraftIssue[] = originChoiceErrors(creationData).map(
    (message) => ({
      id: 'INVALID_ORIGIN_CHOICE',
      group: 'species',
      step: 2,
      severity: 'error',
      message,
      repairTarget: 'species-grant-selection',
    }),
  );
  const featIssues: DraftIssue[] = featEntitlementErrors(
    creationData,
    calculatedCharacter,
    updatedDraft.allowedSources,
  ).map((message) => ({
    id: 'INVALID_FEAT_ENTITLEMENT',
    group: 'class',
    step: 9,
    severity: 'error',
    message,
    repairTarget: 'feat-selection',
  }));
  const allIssues = [
    ...catalogIssues,
    ...spellIssues,
    ...sourceIssues,
    ...classIssues,
    ...originIssues,
    ...featIssues,
  ];
  const isValid = allIssues.filter((i) => i.severity === 'error').length === 0;

  return {
    draft: updatedDraft,
    calculatedCharacter,
    issues: allIssues,
    isValid,
    evaluatedAt: new Date().toISOString(),
    evaluatorVersion: EVALUATOR_VERSION,
    draftRevision: draft.revision ?? 0,
    draftFingerprint: JSON.stringify(updatedDraft),
  };
}

import { generateFirstTurnGuidance } from './guidanceService';

/**
 * Converts an evaluation result into the host CharacterCreationResult contract (CC-206, CC-504)
 */
export function toCharacterCreationResult(
  evaluation: DraftEvaluationResult,
): CharacterCreationResult {
  if (!evaluation.isValid || !evaluation.calculatedCharacter)
    throw new Error(
      evaluation.issues
        .filter((issue) => issue.severity === 'error')
        .map((issue) => issue.message)
        .join(' ') || 'Character has unresolved choices.',
    );
  if ((evaluation.draft.revision ?? 0) !== (evaluation.draftRevision ?? 0))
    throw new Error('Character changed after evaluation. Review again.');
  if (evaluation.draftFingerprint !== JSON.stringify(evaluation.draft))
    throw new Error('Character changed after evaluation. Review again.');
  const creationData = draftToCreationData(evaluation.draft);
  const isArcher =
    evaluation.draft.loadout?.items?.some(
      (i) =>
        i.name.toLowerCase().includes('bow') ||
        i.name.toLowerCase().includes('crossbow'),
    ) ?? false;
  const combatGuidance = generateFirstTurnGuidance(
    evaluation.draft,
    isArcher,
    evaluation.calculatedCharacter,
  );

  return {
    character: {
      ...evaluation.calculatedCharacter,
      id: evaluation.draft.characterId,
    },
    creationAttemptId: evaluation.draft.attemptId,
    draftId: evaluation.draft.draftId,
    draftRevision: evaluation.draft.revision ?? 0,
    creationData,
    edition: evaluation.draft.edition,
    createdAt: evaluation.evaluatedAt,
    combatGuidance,
  };
}
